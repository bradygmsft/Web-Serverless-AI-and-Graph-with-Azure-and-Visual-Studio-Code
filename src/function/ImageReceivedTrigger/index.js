const Gremlin = require('gremlin');
const async = require('async');
let baseImageName = null;

const createGemlinClient = (gremlinUser) => {
    return Gremlin.createClient(
        443,
        process.env.GREMLIN_ENDPOINT,
        {
            "session": false,
            "ssl": true,
            "user": gremlinUser,
            "password": process.env.COSMOSDB_KEY
        }
    );
};

const saveImageToGraph = (gremlinUser, imageUrl, analysis) => {
    baseImageName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
    return new Promise((resolve, reject) => {
        var client = createGemlinClient(gremlinUser);

        client.execute("g.addV('image').property('id','" + baseImageName + "').property('url','" + imageUrl + "')", {}, (e, results) => {
            if (e) {
                reject(e);
            }
            else {
                resolve({
                    message: 'Computer Vision analysis saved to graph for ' + baseImageName + '. Saving tags and captions now.',
                    baseImageName: baseImageName
                });
            }
        });
    });
};

const saveTag = (gremlinUser, tag) => {
    return new Promise((resolve, reject) => {
        var client = createGemlinClient(gremlinUser);
        client.execute("g.addV('tag').property('id','" + tag + "')", {}, (e, results) => {
            if (e) {
                resolve({
                    message: 'Tag ' + tag + ' already exists.'
                });
            }
            else {
                resolve({
                    message: 'Tag ' + tag + ' created.',
                    tag: tag
                });
            }
        });
    });
};

const addTagToImage = (gremlinUser, baseImageName, tag) => {
    return new Promise((resolve, reject) => {
        var client = createGemlinClient(gremlinUser);
        client.execute("g.V('" + baseImageName + "').addE('taggedWith').to(g.V('" + tag + "'))", {}, (tagErr, tagResult) => {
            if (tagErr) {
                reject(tagErr);
            } else {
                resolve({
                    message: 'Computer Vision tag ' + tag + ' added to image ' + baseImageName
                });
            }
        });
    });
};

const saveCaption = (gremlinUser, caption, baseImageName, index) => {
    return new Promise((resolve, reject) => {
        var client = createGemlinClient(gremlinUser);
        var captionId = baseImageName + "-caption-" + index;
        client.execute("g.addV('caption').property('id','" + captionId + "').property('text', '" + caption.text + "').property('confidence', " + caption.confidence + ")", {}, (tagErr, tagResult) => {
            if (tagErr) {
                reject(tagErr);
            } else {
                resolve({
                    message: 'Computer Vision caption ' + caption.text + ' saved.',
                    captionId: captionId
                });
            }
        });
    });
};

const addCaptionToImage = (gremlinUser, baseImageName, captionId) => {
    return new Promise((resolve, reject) => {
        var client = createGemlinClient(gremlinUser);
        client.execute("g.V('" + baseImageName + "').addE('hasCaption').to(g.V('" + captionId + "'))", {}, (tagErr, tagResult) => {
            if (tagErr) {
                reject(tagErr);
            } else {
                resolve({
                    message: 'Computer Vision caption ' + captionId + ' added to image ' + baseImageName
                });
            }
        });
    });
};

module.exports = function (context, myBlob) {
    if (process.env.NODE_ENV !== 'production') {
        require('dotenv').load();
    }

    context.log('getting image ' + context.bindingData.uri);
    context.done();

    const gremlinUser = `/dbs/` + process.env.COSMOSDB_DATABASE + `/colls/` + process.env.COSMOSDB_COLLECTION;
    const request = require('request');
    const subscriptionKey = process.env.COGNITIVE_SERVICES_COMPUTER_VISION_KEY;
    const uriBase = process.env.COGNITIVE_SERVICES_COMPUTER_VISION_URL_BASE + '/analyze';
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
        let analysis = JSON.parse(jsonResponse);

        saveImageToGraph(gremlinUser, imageUrl, analysis)
            .then((imageResult) => {
                console.log(imageResult);

                for(let i=0; i<analysis.description.tags.length; i++) {
                    saveTag(gremlinUser, analysis.description.tags[i])
                        .then((tagSavedResult) => {
                            addTagToImage(gremlinUser, imageResult.baseImageName, tagSavedResult.tag)
                                .then((tagAddedResult) => console.log(tagAddedResult.message));
                        });
                }

                for(let i=0; i<analysis.description.captions.length; i++) {
                    saveCaption(gremlinUser, analysis.description.captions[i], imageResult.baseImageName, i)
                        .then((captionResult) => {
                            addCaptionToImage(gremlinUser, imageResult.baseImageName, captionResult.captionId)
                                .then((captionAddedResult) => console.log(captionAddedResult.message));
                        });
                }
            })
            .catch((err) => {
                console.log(err);
            });
    })};