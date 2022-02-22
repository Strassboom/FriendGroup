// const duplicateMap = require('../lib/duplicateMap.json');
require('dotenv').config();
const Promise = require('bluebird');
const { Sequelize, Op } = require('sequelize');
const emailValidator = require('email-validator');
const moment = require('moment');
const { eq, and, contains, or, not } = require('sequelize/dist/lib/operators');
const { DatabaseError } = require('pg');
const post = require('friendgroupmodels/post');


async function registerIsValid(data,model) {
    const theEmail = data.email;
    if (emailValidator.validate(data.email)) {
        try {
            const user = await getUsers({ data, model });;
            if (user.length == 0) {
                return true
            }
        }
        catch(error) {
            console.log(error);
            console.log(data.email);
        }
    }
    return false
}

async function loginIsValid(data,model) {
    if (emailValidator.validate(data.email)) {
        const user = await getUsers({ data, model });
        if (user.length == 1 && data.password == user[0].password) {
          console.log('works');
            return true
        }
    }
    return false
}

async function getUsers({data, model}) {
  const users = await model.findAll({
    where:
    {
      email: data.email
    }
  });
  console.log(users);
  return users;
}

async function getNewestPublicUsers({ data, userModel, fellowshipModel }) {
  const unAddableStrangers = await fellowshipModel.findAll({
    where:
    {
      subscriberId: data.id
    }
  }).catch(function(error) {
    console.log(error);
  });

  const users = await userModel.findAll({
    where:
    {
      searchable: true,
      dateTimeCreated: { [Op.gt]: moment().subtract(1, 'months') },
      id: {
        [Op.not]: unAddableStrangers.map((stranger) => { return stranger.publisherId })
      }
    }
  }).catch(function(error) {
    console.log(error);
  });
  console.log(users);

  return users;
}

async function getUsersByUsername({data, model}) {
  const users = await model.findAll({
    where:
    {
      username: data.username
    }
  });
  console.log(users);
  return users;
}

async function getUserSearch({ data, userModel, fellowshipModel }) {
  // Get all users by username
  const strangersData = await getUsersByUsername({ data, model: userModel });

  // remove ones that you are already subscribed to
  const unAddableStrangers = await fellowshipModel.findAll({
    where:
    {
      [and]: [
        { publisherId: strangersData.map((stranger) => { return stranger.id }) },
        { subscriberId: data.id }
      ]
    }
  }).catch(function(error) {
    console.log(error);
  });
  if (unAddableStrangers.length > 0){
    const badIds = unAddableStrangers.map((stranger) => { return stranger.publisherId });
    const badIdObjs = badIds.map((badId) => { return { id: badId }});
    const strangersInfo = await getRecords({ data: badIdObjs[0], model: userModel }).catch(function(error) {
      console.log(error);
    });;
    const strangers = strangersInfo.filter((rawStranger) => { !badIds.includes(rawStranger.id) }).map((stranger) => {
      return { username: stranger.username };
    });
    return strangers;
  }
  else {
    const strangers = strangersData.map((stranger) => {
      return { username: stranger.username };
    });
    return strangers;
  }
}

async function getFellowRequests({ data, userModel, fellowRequestModel }) {
  const unAddableStrangers = await fellowRequestModel.findAll({
    where:
    {
      [and]: [
        { publisherId: data.target.id },
        { subscriberId: data.id }
      ]
    }
  }).catch(function(error) {
    console.log(error);
  });
  const requestedParties = [];
  if (unAddableStrangers.length > 0) {
    const user = await getRecord({ data: { id: unAddableStranger[0].publisherId }, model: userModel });
    requestedParties.push({ username: user.username });
  }
  return requestedParties;
}

async function getUser({data, model}) {
  const user = await model.findOne({
    where:
    {
      email: data.email
    }
  });
  console.log(user);
  return user;
}

async function getRecord({ data, model }) {
  try {

    const record = await model.findOne({
      where:
      {
        id: data.id
      }
    });
    console.log(record);
    return record;
  } catch(error) {
    console.log(error);
  }

}

async function getRecords({ data, model }) {
  try {

    const records = await model.findAll({
      where:
      {
        id: data.id
      }
    });
    console.log(records);
    return records;
  } catch(error) {
    console.log(error);
  }

}

async function createRecord({ data, model }) {
  try {
    // This works because model is a function. Model.name is a function prototype that pulls name of func as a string.
    // The name of the model function is what we key the duplicateMap on.
    await model.create(data);
    return {
      success: true
    }
  } catch (error) {
    return {
      success: false,
      error: error
    }
  }
}

async function updateRecord({ currentEmail, data, model }) {
  var record = {};
  for (key in data) {
    if (data[key] != null && (typeof data[key] != 'string' || data[key].trim().length > 0)){
      record[key] = data[key]
    }
  }
  await model.update(record, {
    where: {
      email: currentEmail
    }
  });
}

async function getPosts({ data, model }) {
  const rangeConstraints = {postLimit: 0, postOffset: 0};
  rangeConstraints.postLimit = data.postLimit ? data.postLimit : process.env.PG_POST_LIMIT;
  rangeConstraints.postOffset = data.postOffset ? data.postOffset : process.env.PG_POST_OFFSET;
  const posts = await model.findAndCountAll({
    where: {
      userId: data.id
    },
    limit: rangeConstraints.postLimit,
    offset: rangeConstraints.postOffset
  }).catch(function(error) {
    console.log(error);
  });
  return posts;
}

// advanced version of getPosts. Gets Posts of rself and user's friends
async function getPostsExpanded({ data, userModel, postModel, fellowshipModel }) {
  // Set up range constraints for heavier loads
  const rangeConstraints = { postLimit: 0, postOffset: 0 };
  rangeConstraints.postLimit = data.postLimit ? data.postLimit : process.env.PG_POST_LIMIT;
  rangeConstraints.postOffset = data.postOffset ? data.postOffset : process.env.PG_POST_OFFSET;

  const posts = await getAllPublishers({ data, fellowshipModel, postModel });


  // const usersFellowships = await getAllPublishers({ data, fellowshipModel, postModel });

  // const postCount = await postModel.findAll({
  //   attributes: [
  //     'userId',
  //     [Sequelize.fn('COUNT', Sequelize.col('userId')), 'totalRecentPosts']
  //   ],
  //   group: 'userId',
  //   where : {
  //     dateTimePosted: {
  //       [Op.gt]: moment().subtract(3, 'days')
  //     }
  //   }
  // });

  // // Get total of posts from each user
  // const postPlaceHolder = await postModel.findAll({
  //   attributes: [
  //     'userId',
  //     [Sequelize.fn('COUNT', Sequelize.col('userId')), 'totalRecentPosts']
  //   ],
  //   group: 'userId',
  //   where : {
  //     dateTimePosted: {
  //       [Op.gt]: moment().subtract(3, 'days')
  //     }
  //   }
  // }).catch((error) => {
  //   console.log(error);
  // });
  // for (const post of postCount) {
  //   post.totalRecentPosts = parseInt(post.totalRecentPosts);
  // }
  
  // const posts = await postModel.findAndCountAll({
  //   where: {
  //     userId: data.id
  //   },
  //   limit: rangeConstraints.postLimit,
  //   offset: rangeConstraints.postOffset
  // }).catch(function(error) {
  //   console.log(error);
  // });
  return posts;
}

// Ensures
async function setsAreEqual(a, b) {
  if (a.size !== b.size) {
    return false;
  }

  return Array.from(a).every(element => {
    return b.has(element);
  });
}


// advanced version of getPosts. Gets Posts of rself and user's friends
async function getAllPublishers({ data, fellowshipModel, postModel }) {
  // Set up range constraints for heavier loads
  const rangeConstraints = { postLimit: 0, postOffset: 0 };
  rangeConstraints.postLimit = data.postLimit ? data.postLimit : process.env.PG_POST_LIMIT;
  rangeConstraints.postOffset = data.postOffset ? data.postOffset : process.env.PG_POST_OFFSET;
  
  // Get all tag relations between publishers and subcribed-to user
  const tagCount = await fellowshipModel.findAll({
    where : {
         subscriberId: data.id
    }
  }).catch(error => {
    console.log(error);
  });

  const tagDict = {};
  for (const elem of tagCount) {
    if (!tagDict[elem.publisherId]) {
      tagDict[elem.publisherId] = new Set();
    }
    tagDict[elem.publisherId].add(elem.dataValues.tagId);
  }
  // Get all posts
  const postCount = await postModel.findAll({
    where:
        { userId:
          { [Op.in]: Object.keys(tagDict) }
        }
  }).catch(error => {
    console.log(error);
  });

  // Get total of posts from each user less than 3 days ago Work on this another day
  // const postCount = await postModel.findAll({
  //   attributes: [
  //     'userId',
  //     [Sequelize.fn('COUNT', Sequelize.col('userId')), 'totalRecentPosts']
  //   ],
  //   group: 'userId',
  //   where : {
  //     dateTimePosted: {
  //       [Op.gt]: moment().subtract(3, 'days')
  //     }
  //   }
  // });
  const postsForUser = []
  for (const post of postCount) {
    if (post.tags.every(val => Array.from(tagDict[post.userId]).includes(val))) {
      postsForUser.push(post);
    }
  }
  
  const posts = await postModel.findAndCountAll({
    where: {
      userId: data.id
    },
    limit: rangeConstraints.postLimit,
    offset: rangeConstraints.postOffset
  }).catch(function(error) {
    console.log(error);
  });
  for (const post of postsForUser) {
    posts.rows.push(post)
  }
  const publicPosts = await postModel.findAll({
    where: {
      tags: {
        [Op.contains]: ['Public']
      } 
    },
    limit: rangeConstraints.postLimit,
    offset: rangeConstraints.postOffset
  }).catch(function(error) {
    console.log(error);
  });
  return posts;
}

async function getTags({ model }) {
  const tags = await model.findAll({
  }).catch(function(error) {
    console.log(error);
  });
  return tags;
}

async function getSomeTags({ ids, model }) {
  const tags = await model.findAll({
    where: {
      id : ids
    }
  }).catch(function(error) {
    console.log(error);
  });
  return tags;
}

async function expandPostInfo({ data, userModel, tagModel }) {
  for (const post of data.rows) {
    post.username = await getRecord({ data: { id: post.userId }, model: userModel });
    post.username = post.username.username;
    post.tags = await getSomeTags({ ids: post.tags, model: tagModel });
    post.tags = post.tags = post.tags.map((tag) => { return tag.name });
  }
  return data;
}

async function getNewestPublicPost({ data, postModel, tagModel }) {
  const rangeConstraints = {postLimit: 1, postOffset: 0};
  rangeConstraints.postLimit = data.postLimit ? data.postLimit : process.env.PG_POST_LIMIT;
  rangeConstraints.postOffset = data.postOffset ? data.postOffset : process.env.PG_POST_OFFSET;
  const publicTagRecord = await getTags({ model: tagModel });
  const publicTag = publicTagRecord.filter((tag) => tag.name == 'Public')[0];
  for (i = 0; i < data.targets.length; i++){
    data.targets[i].post = await postModel.findOne({
      where: {
        [and]: [
          {tags: { [Op.contains]: [publicTag.id] }},
          {userId: data.targets[i].id}
        ]
      },
      limit: rangeConstraints.postLimit,
      offset: rangeConstraints.postOffset
    }).catch(function(error) {
      console.log(error);
    });
    for (j = 0; j < data.targets[i].post.tags.length; j++) {
      for (k = 0; k < publicTagRecord.length; k++) {
        if (data.targets[i].post.tags[j] == publicTagRecord[k].id){
          data.targets[i].post.tags[j] = publicTagRecord[k].name;
        }
      }
    }
  }
  return data.targets;
}

async function getFollowers({ publisher, model }) {
  const followers = await model.findAll({
    where:
    {
      publisherId: publisher.id
    }
  });
  console.log(followers);
  return followers;
}

async function deleteFellow({ data, model }) {
  await model.destroy({
    where: {
      [and]: [
        { publisherId: data.publisherId },
        { subscriberId: data.subscriberId }
      ]
    }
  });
}

async function getFellowshipTags({publisher, subscriber, model}) {
  const fellowships = await model.findAll({
    where:
    {
      [and]: [
        { publisherId: subscriber.id },
        { subscriberId: follower.id }
      ]
    }
  });
  console.log(fellowships);
  return fellowships;
}

async function getAllFellows({ publisher, fellowshipModel, tagModel, userModel }) {
  const fellows = {}
  const fellowships = await fellowshipModel.findAll({
    where:
    {
      [or]: [
        { publisherId: publisher.id },
        { subscriberId: publisher.id }
      ]
    }
  });
  // For each pub sub tagId triplet...
  for (const fellowship of fellowships) {
    let followingUser;
    let fellowId;
    // Determine whether the fellow is following the user or being followed by the user
    if (fellowship.publisherId == publisher.id) {
      fellowId = fellowship.subscriberId;
      followingUser = true;
    }
    else {
      fellowId = fellowship.publisherId;
      followingUser = false;
    }
    // If fellow key does not exist then create it
    const fellowData = await getRecord({ data: { id: fellowId }, model : userModel });
    if (!fellows[fellowId]) {
      fellows[fellowId] = { username: fellowData.username, youAreBeingFollowedTags: [], youAreFollowingTags: [] };
    }
    const tag = await getRecord({ data: { id: fellowship.tagId }, model: tagModel });
    // If the fellow is following the user, then add this tag to the corresponding array
    if (followingUser) {
      fellows[fellowId].youAreBeingFollowedTags.push(tag.name);
    }
    else {
      fellows[fellowId].youAreFollowingTags.push(tag.name);
    }
  }
  const newFellows = [];
  for (const key of Object.keys(fellows)) {
    newFellows.push(fellows[key]);
  }
  console.log(newFellows);
  return newFellows;
}

async function getUserFellowRequests({ publisher, fellowRequestModel, userModel }) {
  const fellowRequests = await fellowRequestModel.findAll({
    where:
    {
      [and]: [
        { publisherId: publisher.id }
      ]
    }
  });
  console.log(fellowRequests);
  const requestUsernames = [] 
  for (const fellowRequest of fellowRequests) {
    fellowRequest.info = await getRecord({ data: { id: fellowRequest.subscriberId }, model: userModel });
    requestUsernames.push({ username: fellowRequest.info.username });
  }
  return requestUsernames;
}

async function deleteFellowRequest({ data, model }) {
  await model.destroy({
    where: {
      [and]: [
        { publisherId: data.publisherId },
        { subscriberId: data.subscriberId }
      ]
    }
  });
}

async function sendData({ data, model }) {
  for (let key in data) {
    try {
      // This works because model is a function. Model.name is a function prototype that pulls name of func as a string.
      // The name of the model function is what we key the duplicateMap on.
      const insertResults = await model.bulkCreate(data);
      return {
        success: true,
        recordsUpdated: insertResults.length
      }
    } catch (error) {
      if (error.original.code == 21000 || error.original.code == 23505) {
        const individualResults = await sendIndividualRecords({ records: data, model });
        return individualResults;
      }
      return {
        success: false,
        error: error
      }
    }
  }
}

async function sendIndividualRecords({ records, model }) {
  await Promise.mapSeries(records, async (record, index) => {
    try {
      console.log(record);
      console.log(index);
      const insertResults = await model.bulkCreate([ record ]);//, { updateOnDuplicate: duplicateMap[model.name]});
      console.log(insertResults);
      console.log(`----`)
      return {
        success: true
      }
    } catch (error) {
      // console.log(`${error.code} - ${error.detail} - ${error.table}`);
      console.log(error);
      // throw new Error(error);
    }
  }).catch((error) => {
    console.log(error);
    console.log('ERROR CAUGHT!!!!!!!!!!!!!!!');
    
    return { success: false, error };
  });
  return { success: true };
}

async function updateData(data){
  var sequelizeModels = require('friendgroupmodels')(sequelizeInstance);
  sequelizeModels[modelName].bulkInsert(data,{updateOnDuplicate: true});
  sequelizeInstance.close();
}

async function wipeDataByModel({ model }) {

  if (!model) {
    throw new Error('model is required for wipeDataByTable.');
  }
  const numDestroyed = await model.destroy({
    where: {
    }
  });
  return { success: true, model, numDestroyed };
}

module.exports = {
    getUser,
    getUsers,
    getNewestPublicUsers,
    registerIsValid,
    loginIsValid,
    getRecord,
    createRecord,
    updateRecord,
    getPosts,
    getTags,
    getSomeTags,
    getNewestPublicPost,
    expandPostInfo,
    getAllFellows,
    getUsersByUsername,
    getUserSearch,
    getRecords,
    getFellowRequests,
    getUserFellowRequests,
    deleteFellowRequest,
    deleteFellow,
    getPostsExpanded,
    sendData,
    updateData,
    wipeDataByModel
}
