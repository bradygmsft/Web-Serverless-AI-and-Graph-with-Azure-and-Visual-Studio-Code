module.exports = function (context, myBlob) {
    if (process.env.NODE_ENV !== 'production') {
        require('dotenv').load();
    }

    context.log('getting image ' + context.bindingData.uri);
    context.done();

    const request = require('request');
    const subscriptionKey = process.env.COGNITIVE_SERVICES_COMPUTER_VISION_KEY;
    const uriBase = process.env.COGNITIVE_SERVICES_COMPUTER_VISION_URL_BASE;
    const imageUrl = context.bindingData.uri;

    // Request parameters.
    const params = {
        'visualFeatures': 'Categories,Description,Color',
        'details': '',
        'language': 'en'
    };

    const options = {
        uri: uriBase,
        qs: params,
        body: '{"url": ' + '"' + imageUrl + '"}',
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': subscriptionKey
        }
    };

    request.post(options, (error, response, body) => {
        if (error) {
            console.log('Error: ', error);
            return;
        }
        let jsonResponse = JSON.stringify(JSON.parse(body), null, '  ');
        console.log('JSON Response\n');
        console.log(jsonResponse);
    });
};