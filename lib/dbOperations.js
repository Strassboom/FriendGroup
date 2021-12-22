// const duplicateMap = require('../lib/duplicateMap.json');
require('dotenv').config();
const Promise = require('bluebird');
const { Sequelize, Op } = require('sequelize');
const emailValidator = require('email-validator');
const { eq, and, contains, or, not } = require('sequelize/dist/lib/operators');
// TODO: The whole file needs unit testing. Once we add unit testing here, we should re-work the error handling section of sendIndividualRecords, but currently
// I am too worried about breaking functionality for TIBA to optimize this comfortably.


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
    if (data[key] != null && data[key].trim().length > 0){
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
  // logger.info(`Starting sendIndividualRecords for table ${model.name} due to duplicate records detected inside the chunk.`);
  // model.upsert does not work as I thought it would in this situation. It does not 
  await Promise.mapSeries(records, async (record, index) => {
    try {
      console.log(record);
      console.log(index);
      // const insertResults = await model.upsert(record, { fields: duplicateMap[model.name]});
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
    registerIsValid,
    loginIsValid,
    getRecord,
    createRecord,
    updateRecord,
    getPosts,
    getTags,
    getSomeTags,
    expandPostInfo,
    getAllFellows,
    getUsersByUsername,
    getUserSearch,
    getRecords,
    getFellowRequests,
    getUserFellowRequests,
    deleteFellowRequest,
    deleteFellow,
    sendData,
    updateData,
    wipeDataByModel
}
