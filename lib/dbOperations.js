// const duplicateMap = require('../lib/duplicateMap.json');
require('dotenv').config();
const Promise = require('bluebird');
const { Sequelize } = require('sequelize');
const emailValidator = require('email-validator');
const { eq, and, contains } = require('sequelize/dist/lib/operators');
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

// function addLocIds({ data, locationId }) {
//   return data.map((record) => {
//     record.location_id = Number(locationId);
//     return record;
//   })
// }

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
    sendData,
    updateData,
    wipeDataByModel
}
