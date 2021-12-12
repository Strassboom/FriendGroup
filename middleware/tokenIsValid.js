const jwt = require('jsonwebtoken');

module.exports = function tokenIsValid(request, response, next) {
    if (request.cookies.token) {
        jwt.verify(request.cookies.token, 'secret', (err, decodedToken) => {
            if (err) {
                request.tokenIsValid = false;
            }
            else {
                request.email = decodedToken.email;
                request.username = decodedToken.username;
                request.tokenIsValid = true;
            }
        });
    }
    else {
        request.tokenIsValid = false;
    }
    next();
}