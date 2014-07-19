/*=====================================
=            MU's JSON API            =
=====================================*/
/**
 *
 * A simple API to serve json data to subscribed sites.
 *
 * http://mu-api-warlord.herokuapp.com
 *
 * Author: Josh MU
 * Created: 19/07/2014
 *
 **/


//modules
var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser = require('body-parser');
var mongo = require('mongodb').MongoClient;

//constants
//mongo uri as per heroku > mongolabs
var mongoUri = process.env.MONGOLAB_URI ||
    process.env.MONGOHQ_URL ||
    'mongodb://localhost/test-api';
var port = 3000;

/**
 * heroku config | grep MONGOLAB_URI
 * mongo ds041228.mongolab.com:41228/heroku_app27508653 -u <dbuser> -p <dbpass>
 **/

//combine
var app = express();
var server = http.createServer(app);

//express setup
app.set('port', process.env.PORT || port);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

//CORS middleware
var config = {
    allowedDomains: ['*']
};
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', config.allowedDomains);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
};
app.use(allowCrossDomain);

//listen
server.listen(app.get('port'), function(err) {
    console.log(err || 'Connected on ' + app.get('port'));
});


/**
 * DATABASE PLAN
 *
 * [SITE]
 *     ->url
 *     ->ref
 *     ->admin
 *     ->visited
 *     ->updated
 *     ->created
 *     ->security
 *
 * [ITEM]
 *     ->ref
 *     ->type
 *     ->name
 *     ->content
 *     ->date
 *     ->created
 *     ->updated
 *
 */

/**
 * ROUTES
 *
 * /
 * GET > return list of 'ref's and 'url's
 *
 * /[ref]
 * GET > return site info
 * PUT > change site info (restricted)
 *
 * /[ref]/items
 * GET > return all items with 'ref'
 * POST > add add item with 'ref'
 *
 * /[ref]/items/[type]/[title]
 * GET > get specific item
 * EDIT > update item
 * DELETE > remove item
 *
 **/

/*==============================
=            ROUTES            =
==============================*/
//TODO: use regex for the routes for more client flexibility

app.get('/', function(req, res) {
    showSites(function(err, sites) {
        cbResponse(res, err, {
            message: 'This is Mu\'s api, you better know what you are doing.',
            urls: getValues('url', sites),
            refs: getValues('ref', sites)
        });
    });
});

// {object} mu_api > hold all info required for queries to database
app.param('ref', function(req, res, next, ref) {
    req.mu_api = {
        ref: ref
    };
    next();
});

app.route('/:ref')
    .get(function(req, res) {
        getSite(req.mu_api, function(err, site) {
            cbResponse(res, err, site);
        });
    })
    .put(function(req, res) {
        updateSite(req.mu_api, req.body, function(err) {
            cbResponse(res, err, 'Site information updated.');
        });
    });

app.route('/:ref/items')
    .get(function(req, res) {
        getItems(req.mu_api, function(err, data) {
            cbResponse(res, err, data);
        });
    })
    .post(function(req, res) {
        addItem(req.mu_api, req.body, function(err) {
            cbResponse(res, err, 'Item has been added.');
        });
    });

app.param('type', function(req, res, next, type) {
    req.mu_api.type = type;
    next();
});

app.param('title', function(req, res, next, title) {
    req.mu_api.title = title;
    next();
});

app.route('/:ref/items/:type/:title')
    .get(function(req, res) {
        getItem(req.mu_api, function(err, data) {
            cbResponse(res, err, data);
        });
    })
    .put(function(req, res) {
        updateItem(req.mu_api, req.body, function(err, data) {
            cbResponse(res, err, 'Item udpated.');
        });
    })
    .delete(function(req, res) {
        deleteItem(req.mu_api, function(err, data) {
            cbResponse(res, err, 'Item deleted');
        });
    });

/**
 * handle the response to client
 * @param  {object} res  server response
 * @param  {object||string} err  error object or custom message
 * @param  {object||string} data json data or custom message
 */
//TODO: this needs work, err will be present as soon as custom string is created
function cbResponse(res, err, data) {
    function errMsgObj(err) {
        return typeof err === 'string' ? {
            error: err
        } : {
            error: err.message
        };
    }

    function dataMsgObj(data) {
        return typeof data === 'string' ? {
            message: data
        } : data;
    }
    res.json(err ? errMsgObj(err) : dataMsgObj(data));
}


/*=============================
=            MONGO            =
=============================*/
//TODO: need to research what the callback args are for each type of mongo request and parse accordingly

/**
 * retrieve  info on all sites
 * @param  {Function} cb
 */
function showSites(cb) {
    mongo.connect(mongoUri, function(err, db) {
        if (err) return cb(err);
        db.collection('sites')
            .find()
            .toArray(function(err, data) {
                db.close();
                return err ? cb(err) : cb(null, data);
            });
    });
}

/**
 * get list of values from specific key of all sites
 * @param  {String} key property
 * @param  {Array} arr array of object
 * @return {Array}     list of values
 */
function getValues(key, arr) {
    var values = [];
    arr.forEach(function(site) {
        for (var prop in site) {
            if (site.hasOwnProperty(prop) && key === prop) {
                values.push(site[prop]);
            }
        }
    });
    return values;
}

/**
 * return all info on a site
 * @param  {Object}   query
 * @param  {Function} cb
 */
function getSite(query, cb) {
    mongo.connect(mongoUri, function(err, db) {
        if (err) return cb(err);
        db.collection('sites')
            .find(query)
            .toArray(function(err, data) {
                db.close();
                return err ? cb(err) : cb(null, data);
            });
    });
}

/**
 * update site information
 * @param  {Object}   query
 * @param  {Object}   newInfo
 * @param  {Function} cb
 * @return {Function}
 */
function updateSite(query, newInfo, cb) {
        newInfo.updated = new Date(); //add updated time
        mongo.connect(mongoUri, function(err, db) {
            if (err) return cb(err);
            db.collection('sites')
                .update(query, {
                    $set: newInfo
                }, function(err, data) {
                    return err ? cb(err) : cb(null, data);
                });
        });
    }
    //TODO: restrict update to only specified fields


/**
 * get all items with property of 'ref'
 * @param  {Object}   query > query.ref is what we want
 * @param  {Function} cb
 * @return {Function}
 */
function getItems(query, cb) {
    mongo.connect(mongoUri, function(err, db) {
        if (err) return cb(err);
        db.collection('items')
            .find(query)
            .toArray(function(err, data) {
                return err ? cb(err) : cb(null, data);
            });
    });
}

/**
 * get specific item from database
 * @param  {Object}   query
 * @param  {Function} cb
 * @return {Function}
 */
function getItem(query, cb) {
    mongo.connect(mongoUri, function(err, db) {
        if (err) return cb(err);
        db.collection('items')
            .find(query)
            .toArray(function(err, data) {
                return err ? cb(er) : cb(null, data);
            });
    });
}


/**
 * add an item to the database
 * @param {Object}   query
 * @param {Object}   item
 * @param {Function} cb
 * @return {Function}
 */
function addItem(query, item, cb) {
    item.ref = query.ref; //item needs to include ref
    item.created = new Date(); //add creation time
    mongo.connect(mongoUri, function(err, db) {
        if (err) return cb(err);
        db.collection('items')
            .insert(item, function(err) {
                return err ? cb(err) : cb(null);
            });
    });
}

/**
 * update a specific item
 * @param  {Object}   query
 * @param  {Object}   newItem
 * @param  {Function} cb
 * @return {Function}
 */
function updateItem(query, newItem, cb) {
    newItem.updated = new Date(); //include updated time
    mongo.connect(mongoUri, function(err, db) {
        if (err) return cb(err);
        db.collection('items')
            .update(query, {
                $set: newItem
            }, function(err, data) {
                db.close();
                return err ? cb(err) : cb(null, err);
            });
    });
}

/**
 * remove item
 * @param  {Object}   query
 * @param  {Function} cb
 * @return {Function}
 */
function deleteItem(query, cb) {
    mongo.connect(mongoUri, function(err, db) {
        if (err) return cb(err);
        db.collection('items')
            .remove(query, function(err) {
                return err ? cb(err) : cb(null);
            });
    });
}
