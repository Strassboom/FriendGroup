#!/usr/bin/env node
const WebSocketServer = require('websocket').server;
const http = require('http');
const express = require('express');
var multer = require('multer');
var upload = multer();
const app = express();
const dbOperations = require('./lib/dbOperations');
const tokenIsValid = require('./middleware/tokenIsValid');
const Promise = require('bluebird');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const cookieParser = require("cookie-parser");
const tag = require('friendgroupmodels/tag');

app.set('views', __dirname + '\\views');
app.set('view engine', 'ejs');

// for parsing application/json
app.use(express.json()); 

// for parsing application/xwww-
app.use(express.urlencoded({ extended: true })); 
//form-urlencoded

app.use(cookieParser());

// for parsing multipart/form-data
app.use(upload.array()); 
app.use(express.static('public'));

app.get('/', async (request,response) => {
    //console.log(localStorage);
    // // Add sequelize model work here:

    // //Create sessionId
    // const record = { dateTime: new Date(), shipId: 'fafnir' };
    // record.id = new Buffer.from(`${request.hostname}:${record.dateTime.getTime()}`).toString('base64');
    // const sequelizeInstance = require('./lib/sqlConnection');
    // const models = require('topics-models').models(sequelizeInstance);
    // const model = models['session'];
    // console.log((new Date()) + ' Received request for ' + request.url);
    // await dbOperations.sendData({ data: [record], model }).then(async function (sendResults) {
    //     console.log(sendResults);    
    //     if (sendResults.error) {
    //           console.log(sendResults.error, { sendResults })
    //         }
    //     }).catch(async function (error) {
    //         console.log(error);
    //     });
    // response.send(record);

    // Redirect visitor since no user logged in
    response.redirect(301,'/gate');
});

// Visiting the gateway page before submitting any account information or accessing the internal website
app.get('/gate', async (request,response) => {
    info = { data : 'Please Log In or Register' };
    response.render('gate', { data : info.data });
});

// Visiting the gateway page after submitting either registration information or login credentials
app.post('/gate', async (request,response) => {
    const sequelizeInstance = require('./lib/sqlConnection');
    const models = require('friendgroupmodels').models(sequelizeInstance);
    const model = models['user'];
    const info = { data : '' };
    
    // If registering
    if ('registerButton' in request.body) {
        const record = { email: request.body.email, password: request.body.password };
        const tagModel = models['tag'];
        const tags = await dbOperations.getTags({ model: tagModel });
        record.tags = tags.map((tag) => tag.id);
        // If Username and password are valid
        const validRegister = await dbOperations.registerIsValid(record,model);
        console.log(validRegister);

        // Write Database code here
        if (validRegister) {
            const dateTimeCreated = moment();
            record.dateTimeCreated = dateTimeCreated.format();
            record.id = `${request.hostname}-${dateTimeCreated.unix()}`;
            record.username = record.email;
            await dbOperations.createRecord({ data: record, model }).then(async function (sendResults) {
                console.log(sendResults);    
                if (sendResults.error) {
                    console.log(sendResults.error, { sendResults })
                    }
                }).catch(async function (error) {
                    console.log(error);
                }
            );
            info.data = 'Account created!'
            response.render('gate', { data: info.data });
        }

        // If Username and password are NOT valid
        else {
            info.data = 'Account not created! Email or Password invalid!';
            console.log(info.data);
            response.render('gate', { data: info.data });
        }

    }
    // If logging in
    else if ('loginButton' in request.body) {
        // If Email\Password exists and is valid
        const record = { email: request.body.email, username: request.body.email, password: request.body.password };
        const validLogin = await dbOperations.loginIsValid(record,model);
        // Write Database code here
        if (validLogin) {
            record.username = await dbOperations.getUser({ data: record, model }).then((user) => { return user.username });
            const token = jwt.sign(record,
                'secret'
            );
            response.cookie('token', token);
            response.redirect(301,`/home`);
        }
        else {
            info.data = 'Account not created! Email or Password invalid!';
            response.render('gate', { data: info.data });
        }
    }
});


app.get('/home', tokenIsValid, async (request, response) => {
    // If token is still valid
    if (request.tokenIsValid) {
        const sequelizeInstance = require('./lib/sqlConnection');
        const models = require('friendgroupmodels').models(sequelizeInstance);
        const userModel = models['user'];
        const tagModel = models['tag'];
        const postModel = models['post'];
        const fellowshipModel = models['fellowship'];
        const data = { email: request.email };
        const tags = await dbOperations.getTags({ data, model: tagModel });
        const tagsDict = {};
        for (const tag of tags) {
            tagsDict[tag.id] = tag.name;
        }
        //Get current user
        //Get most recent posts
        // Get names of tags from posts and assign username to each post
        data.tags = tags;
        data.tags = data.tags.map((tag) => {
            return tag.name;
        });
        const user = await dbOperations.getUser({ data, model: userModel });
        data.id = user.id;
        data.username = user.username;
        data.viewTags = [];
        for (const tag of user.tags) {
            if (tagsDict[tag] != 'Public') {
                data.viewTags.push(tag);
            }
            else {
                data.publicTag = tag;
            }
        }

        data.posts = await dbOperations.getPostsExpanded({ data, userModel, postModel, fellowshipModel });
        //data.posts = await dbOperations.getPosts({ data: user, model: postModel });
        data.posts = await dbOperations.expandPostInfo({ data: data.posts, userModel, tagModel });
        // Assigning the tag names to each given post that has said tag ids


        response.render('home', { data : data });
    }
    else{
        response.redirect(301,'/gate');
    }
});

// Redirects to a GET request for /home
app.post('/home', tokenIsValid, async (request, response) => {
    // If token is still valid
    if (request.tokenIsValid) {
        if (!request.body.postContent) {
            if (request.body.writeContent && request.body.writeContent.trim().length > 0) {
                const sequelizeInstance = require('./lib/sqlConnection');
                const models = require('friendgroupmodels').models(sequelizeInstance);
                const userModel = models['user'];
                const tagModel = models['tag'];
                const postModel = models['post'];
                const data = { email: request.email };
                //Fetch User for Id to make post
                const user = await dbOperations.getUser({ data, model: userModel });
                data.tags = await dbOperations.getTags({ data, model: tagModel });
                const post = { userId: user.id, content: request.body.writeContent, dateTimePosted: moment(), dateTimeDeleted: null, isDeleted: false, cheers: 0 };
                post.id = `${user.id}#${post.dateTimePosted}`;
                post.tags = data.tags.filter((tag) => Object.keys(request.body).includes(tag.name)).map((relevantTag) => { return relevantTag.id });
                await dbOperations.createRecord({ data: post, model: postModel });
                response.redirect(301,'/home');
            }
            else {
                response.redirect(301,'/home');
            }
        }
        else {
            response.redirect(301,'/home');
        }
    }
    else{
        response.redirect(301,'/gate');
    }
});

app.get('/settings', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        const sequelizeInstance = require('./lib/sqlConnection');
        const models = require('friendgroupmodels').models(sequelizeInstance);
        const tagModel = models['tag'];
        const userModel = models['user'];
        const tags = await dbOperations.getTags({ model: tagModel });
        const record = { email: request.email };
        console.log(record);
        const userData = await dbOperations.getUser({ data: record, model: userModel });
        // response.redirect(301,'/settings');
        const searchable = userData.searchable;
        const userTags = [];
        for (i = 0; i < tags.length; i++) {
            if (userData.tags.includes(tags[i].id)) {
                tags[i].included = true;
            }
            else {
                tags[i].included = false;
            }
        }
        response.render('settings', { data : { greeting: `Welcome to Settings, ${userData.username}!`, searchable, tags } });
    }
    else{
        response.redirect(301,'gate');
    }
});

app.post('/settings', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        const sequelizeInstance = require('./lib/sqlConnection');
        const models = require('friendgroupmodels').models(sequelizeInstance);
        const model = models['user'];
        const tagModel = models['tag'];
        const tags = await dbOperations.getTags({ model: tagModel });
        const searchable = Object.keys(request.body).includes('searchable') ? true  : false;
        const record = { email: request.body.email, username: request.body.username, password: request.body.password, searchable };
        record.tags = tags.filter((tag) => Object.keys(request.body).includes(tag.name)).map((relevantTag) => { return relevantTag.id });
        console.log(record);
        await dbOperations.updateRecord({ currentEmail: request.email, data: record, model });
        if (record.email == null || record.email.trim().length == 0) {
            record.email = request.email;
        }
        const userData = await dbOperations.getUser({ data: record, model });
        const token = jwt.sign(record,
            'secret'
        );
        response.cookie('token', token);
        // response.redirect(301,'/settings');
        for (i = 0; i < tags.length; i++) {
            if (record.tags.includes(tags[i].id)) {
                tags[i].included = true;
            }
            else {
                tags[i].included = false;
            }
        }
        response.render('settings', { data : { greeting: `Welcome to Settings, ${userData.username}!`, searchable, tags } });
    }
    else{
        response.redirect(301,'gate');
    }
});

app.get('/fellows', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        // Get all users following or being followed by current user and their tags
        const sequelizeInstance = require('./lib/sqlConnection');
        const models = require('friendgroupmodels').models(sequelizeInstance);
        // Get models needed
        const userModel = models['user'];
        const fellowshipModel = models['fellowship'];
        const tagModel = models['tag'];
        // Get user so you can use its id for get fellowship tags
        const user = await dbOperations.getUser({ data: { email: request.email }, model: userModel });
        const data = { user }
        data.fellows = await dbOperations.getAllFellows({ publisher: user, fellowshipModel, tagModel, userModel });
        response.render('fellows', { data });
    }
    else{
        response.redirect(301,'gate');
    }
});

app.post('/fellows', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        // Get all users following or being followed by current user and their tags
        const sequelizeInstance = require('./lib/sqlConnection');
        const models = require('friendgroupmodels').models(sequelizeInstance);
        // Get models needed
        const userModel = models['user'];
        const fellowshipModel = models['fellowship'];
        const tagModel = models['tag'];
        // Get user so you can use its id for get fellowship tags
        const user = await dbOperations.getUser({ data: { email: request.email }, model: userModel });
        const fellowInfo = await dbOperations.getUsersByUsername({ data: { username: request.body['remove-user'] }, model: userModel });
        const fellow = fellowInfo[0];
        const data = { user }
        // Sever all connection with user
        await dbOperations.deleteFellow({ data: { publisherId: user.id, subscriberId: fellow.id }, model: fellowshipModel });
        await dbOperations.deleteFellow({ data: { publisherId: fellow.id, subscriberId: user.id }, model: fellowshipModel });
        response.redirect(301, 'fellows');
    }
    else{
        response.redirect(301,'gate');
    }
});

app.post('/usersearch', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        // If user is sending a fellow request
        if (request.body['add-user']) {
            // Generic info
            const sequelizeInstance = require('./lib/sqlConnection');
            const models = require('friendgroupmodels').models(sequelizeInstance);
            const userModel = models['user'];
            const fellowRequestModel = models['fellowrequest'];
            const data = { email: request.email };
            const user = await dbOperations.getUser({ data, model: userModel });
            const publisher = await dbOperations.getUsersByUsername({ data: { username: request.body['add-user'] }, model: userModel });
            // Create fellowrequest record
            await dbOperations.createRecord({ data: { publisherId: publisher[0].id, subscriberId: user.id, dateTimeCreated: moment().format() }, model: fellowRequestModel }).then(async function (sendResults) {
                console.log(sendResults);    
                if (sendResults.error) {
                    console.log(sendResults.error, { sendResults })
                    }
                }).catch(async function (error) {
                    console.log(error);
                });
            data.strangers = [];
            response.render('usersearch', { data });
        }
        // If user not adding other user, load all results from searchbar
        else {
            const sequelizeInstance = require('./lib/sqlConnection');
            const models = require('friendgroupmodels').models(sequelizeInstance);
            const userModel = models['user'];
            const fellowshipModel = models['fellowship'];
            const fellowRequestModel = models['fellowrequest'];
            const data = { email: request.email };
            const user = await dbOperations.getUser({ data, model: userModel });
            data.id = user.id;
            data.username = request.body.userSearch;
            data.target = await dbOperations.getUsersByUsername({ data: { username: data.username }, model: userModel });
            if (data.target.length > 0){
                data.target = data.target[0];
                const strangers = await dbOperations.getUserSearch({ data, userModel, fellowshipModel });
                const strangersList = strangers.map((stranger) => { return stranger.username });
                const requesters = await dbOperations.getFellowRequests({ data, userModel, fellowRequestModel });
                const requestersList = requesters.map((requester) => { return requester.username });
                const message = "Welcome to the User Search Page!";
                data.strangers = strangers.filter(stranger => !requesters.map(requester => requester.username).includes(stranger.username));    
                if (user.username == data.username) {
                    data.strangers = [];
                }
                data.message = message;
                delete data.id;
                delete data.target;
                delete data.username;
                delete data.email;
            }
            else {
                data.strangers = [];
            }
            response.render('usersearch', { data });
        }
    }
    else{
        response.redirect(301,'gate');
    }
});

// Quickfix for staying on usersearch after adding an individual or refreshing the page
app.get('/usersearch', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        const data = { email: request.email };
        data.strangers = [];
        response.render('usersearch', { data });
    }
    else{
        response.redirect(301,'gate');
    }
});

app.post('/publicusersearch', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        // If user is sending a fellow request
        if (request.body['add-user'] && request.body["userSearchSubmit"].trim().length > 0) {
            // Generic info
            const sequelizeInstance = require('./lib/sqlConnection');
            const models = require('friendgroupmodels').models(sequelizeInstance);
            const userModel = models['user'];
            const tagModel = models['user'];
            const fellowRequestModel = models['fellowrequest'];
            const data = { email: request.email };
            const tags = await dbOperations.getTags({ data, model: tagModel });
            const tagsDict = {};
            for (const tag of tags) {
                tagsDict[tag.id] = tag.name;
            }
            data.tags = tags;
            data.tags = data.tags.map((tag) => {
                return tag.name;
            });
            const user = await dbOperations.getUser({ data, model: userModel });
            data.id = user.id;
            data.username = user.username;
            data.viewTags = [];
            for (const tag of user.tags) {
                if (tagsDict[tag] != 'Public') {
                    data.viewTags.push(tag);
                }
                else {
                    data.publicTag = tag;
                }
            }
            const publisher = await dbOperations.getUsersByUsername({ data: { username: request.body['add-user'] }, model: userModel });
            // Create fellowrequest record
            await dbOperations.createRecord({ data: { publisherId: publisher[0].id, subscriberId: user.id, dateTimeCreated: moment().format() }, model: fellowRequestModel }).then(async function (sendResults) {
                console.log(sendResults);    
                if (sendResults.error) {
                    console.log(sendResults.error, { sendResults })
                    }
                }).catch(async function (error) {
                    console.log(error);
                });
            data.strangers = [];
            response.render('usersearch', { data });
        }
        // If user not adding other user, load all results from searchbar
        else {
            const sequelizeInstance = require('./lib/sqlConnection');
            const models = require('friendgroupmodels').models(sequelizeInstance);
            const userModel = models['user'];
            const postModel = models['post'];
            const tagModel = models['tag'];
            const fellowshipModel = models['fellowship'];
            const fellowRequestModel = models['fellowrequest'];
            const data = { email: request.email };
            const tags = await dbOperations.getTags({ data, model: tagModel });
            const tagsDict = {};
            for (const tag of tags) {
                tagsDict[tag.id] = tag.name;
            }
            data.tags = tags;
            data.tags = data.tags.map((tag) => {
                return tag.name;
            });
            const user = await dbOperations.getUser({ data, model: userModel });
            data.id = user.id;
            data.username = user.username;
            data.viewTags = [];
            for (const tag of user.tags) {
                if (tagsDict[tag] != 'Public') {
                    data.viewTags.push(tag);
                }
                else {
                    data.publicTag = tag;
                }
            }
            data.username = request.body.userSearch;
            data.targets = await dbOperations.getNewestPublicUsers({ data, userModel, fellowshipModel });
            data.strangers = await dbOperations.getNewestPublicPost({ data, postModel, tagModel });
            const message = "Welcome to the User Search Page!";
            data.message = message;
            delete data.id;
            delete data.username;
            delete data.email;
            response.render('publicusersearch', { data });
        }
    }
    else{
        response.redirect(301,'gate');
    }
});

app.get('/publicusersearch', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        const sequelizeInstance = require('./lib/sqlConnection');
        const models = require('friendgroupmodels').models(sequelizeInstance);
        const userModel = models['user'];
        const postModel = models['post'];
        const tagModel = models['tag'];
        const fellowshipModel = models['fellowship'];
        const fellowRequestModel = models['fellowrequest'];
        const data = { email: request.email };
        const user = await dbOperations.getUser({ data, model: userModel });
        data.id = user.id;
        data.username = request.body.userSearch;
        data.targets = await dbOperations.getNewestPublicUsers({ data, userModel, fellowshipModel });
        data.strangers = await dbOperations.getNewestPublicPost({ data, postModel, tagModel });
        const message = "Welcome to the User Search Page!";
        data.message = message;
        delete data.id;
        delete data.username;
        delete data.email;
        response.render('publicusersearch', { data });
    }
    else{
        response.redirect(301,'gate');
    }
});

// Presents all fellow requests by other users to follow current user
app.get('/fellowrequests', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        const sequelizeInstance = require('./lib/sqlConnection');
        const models = require('friendgroupmodels').models(sequelizeInstance);
        const userModel = models['user'];
        const fellowRequestModel = models['fellowrequest'];
        const tagModel = models['tag'];
        const data = { email: request.email };
        const user = await dbOperations.getUser({ data, model: userModel });
        data.strangers = await dbOperations.getUserFellowRequests({ publisher: user, fellowRequestModel, userModel });
        data.tags = await dbOperations.getTags({ model: tagModel });
        data.tags = data.tags.map((tag) => {
            return tag.name;
        });
        response.render('fellowrequests', { data });
    }
    else {
        response.redirect(301,'gate');
    }
});

// Updates fellow requests list with any changes performed by user (accepting/rejecting a user)
app.post('/fellowrequests', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        if (request.body['accept-user']) {
            const sequelizeInstance = require('./lib/sqlConnection');
            const models = require('friendgroupmodels').models(sequelizeInstance);
            const userModel = models['user'];
            const fellowRequestModel = models['fellowrequest'];
            const fellowshipModel = models['fellowship'];
            const data = { email: request.email };
            // Add user with tags to fellowship db
            const user = await dbOperations.getUser({ data, model: userModel });
            const subscriberInfo = await dbOperations.getUsersByUsername({ data: { username: request.body['accept-user'] }, model: userModel });
            const subscriber = subscriberInfo[0];
            const fellowships = [];
            const tags = request.body;
            delete tags['accept-user'];
            for (const tag in request.body) {
                fellowships.push({ publisherId: user.id, subscriberId: subscriber.id, tagId: request.body[tag].split('-')[1], dateTimeCreated: moment().format() });
            }
            for (const fellowship of fellowships) {
                await dbOperations.createRecord({ data: fellowship, model: fellowshipModel });
            }
            await dbOperations.deleteFellowRequest({ data: { publisherId: user.id, subscriberId: subscriber.id }, model: fellowRequestModel });
            response.redirect(301,'fellowrequests');
        }
        else {
            const sequelizeInstance = require('./lib/sqlConnection');
            const models = require('friendgroupmodels').models(sequelizeInstance);
            const userModel = models['user'];
            const fellowRequestModel = models['fellowrequest'];
            const data = { email: request.email };
            // Add user with tags to fellowship db
            const user = await dbOperations.getUser({ data, model: userModel });
            const subscriber = await dbOperations.getUsersByUsername({ data: { username: request.body['reject-user'] }, model: userModel });
            await dbOperations.deleteFellowRequest({ data: { publisherId: user.id, subscriberId: subscriber[0].id }, model: fellowRequestModel });
            response.redirect(301,'fellowrequests');
        }
    }
    else {
        response.redirect(301,'gate');
    }
});

// Logs user out of the network
app.get('/logout', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        response.clearCookie("key");
        response.redirect(301,'gate');
    }
    else {
        response.redirect(301,'gate');
    }
});

const server = http.createServer(app);


server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});

// const wsServer = new WebSocketServer({
//     httpServer: server,
//     // You should not use autoAcceptConnections for production
//     // applications, as it defeats all standard cross-origin protection
//     // facilities built into the protocol and the browser.  You should
//     // *always* verify the connection's origin and decide whether or not
//     // to accept it.
//     autoAcceptConnections: false
// });

// function originIsAllowed(origin) {
//   // put logic here to detect whether the specified origin is allowed.
//   return true;
// }

// wsServer.on('request', function(request) {
//     if (!originIsAllowed(request.origin)) {
//       // Make sure we only accept requests from an allowed origin
//       request.reject();
//       console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
//       return;
//     }
    
//     var connection = request.accept('json', request.origin);
//     console.log((new Date()) + ' Connection accepted.');
//     connection.on('message', async function(message) {
//         if (message.type === 'utf8') {
//             console.log('Received Message: ' + message.utf8Data);
//             record = JSON.parse(message.utf8Data);
//             // If a session event, send to the db as one
//             if (record[0].sessionId){
//                 await Promise.mapSeries(record, async function(rec) {
//                     rec.id = new Buffer.from(`${request.hostname}:${new Date(rec.dateTime).getTime()}`).toString('base64');
//                     rec.positionX = rec.position.x;
//                     rec.positionY = rec.position.y;
//                     return rec;
//                 }).then(async function (record) {
//                     const sequelizeInstance = require('./lib/sqlConnection');
//                     const models = require('topics-models').models(sequelizeInstance);
//                     const model = models['sessionEvent'];
//                     console.log(record);
//                     await dbOperations.sendData({ data: record, model }).then(async function (sendResults) {
//                         console.log(sendResults);    
//                         if (sendResults.error) {
//                               console.log(sendResults.error, { sendResults })
//                             }
//                         }).catch(async function (error) {
//                             console.log(error);
//                         });
//                 });
//             }
//             connection.sendUTF(message.utf8Data);
//         }
//         else if (message.type === 'binary') {
//             console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
//             connection.sendBytes(message.binaryData);
//         }
//     });
//     connection.on('close', function(reasonCode, description) {
//         console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
//     });
// });