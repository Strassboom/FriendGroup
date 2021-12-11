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
        const record = { email: request.body.email, password: request.body.password };
        const validLogin = await dbOperations.loginIsValid(record,model);
        // Write Database code here
        if (validLogin) {
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
    // if (request.cookies.token) {
    //     const decode = jwt.verify(request.cookies.token, 'secret', (err, decodedToken) => {
    //         if (err) {
    //             response.redirect(301,'gate');
    //         }
    //         else {
    //             response.render('home', { data : `Welcome home, ${decodedToken.email}!` });
    //         }
    //     });
    //     console.log(decode);
    // }
    // else {
    //     response.redirect(301,'gate');
    // }
    if (request.tokenIsValid) {
        response.render('home', { data : `Welcome home!` });
    }
    else{
        response.redirect(301,'/gate');
    }
});

app.get('/settings', tokenIsValid, async (request, response) => {
    if (request.tokenIsValid) {
        const sequelizeInstance = require('./lib/sqlConnection');
        const models = require('friendgroupmodels').models(sequelizeInstance);
        const model = models['user'];
        const record = { email: request.email };
        console.log(record);
        const userData = await dbOperations.getUser({ data: record, model });
        // response.redirect(301,'/settings');
        response.render('settings', { data : `Welcome to Settings, ${userData.username}!` });
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
        const record = { email: request.body.email, username: request.body.username, password: request.body.password };
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
        response.render('settings', { data : `Welcome to Settings, ${userData.username}!` });
    }
    else{
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