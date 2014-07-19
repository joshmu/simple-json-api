var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser = require('body-parser');
var mongo = require('mongodb').MongoClient;

var mongoUri = process.env.MONGOLAB_URI ||
    process.env.MONGOHQ_URL ||
    'mongodb://localhost/test-api';

var app = express();
var server = http.createServer(app);
var port = 3000;

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

//LISTEN
server.listen(app.get('port'), function(err) {
    console.log(err || 'Connected on ' + app.get('port'));
});


/**
 * ROUTES
 *
 * /[ref]
 * GET > return all results
 * POST > add 'title'
 * PUT > change 'title'
 *
 * /[ref]/items
 * GET > return 'items'
 * POST > add 'item'
 *
 * /[ref]/items/[type]/[title]
 * GET > get specific item
 * EDIT > edit specific item of 'type' & 'title'
 * DELETE > delete specific item of 'type' & 'title' (use mongo _id later)
 *
 **/
app.get('/', function(req, res) {
    // var refs = [];
    // for (var key in ref) {
    //     if (ref.hasOwnProperty(key)) {
    //         refs.push(key);
    //     }
    // }

    showSites(function(err, sites) {
        if (err) {
            res.json({
                error: err.message
            });
        } else {
            var urls = getValues('url', sites);
            var refs = getValues('ref', sites);
            res.json({
                message: 'This is Mu\'s api, you better know what you are doing.',
                urls: urls,
                refs: refs
            });
        }
    });

});

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


/**
 * retrieve  info on all sites
 * @param  {Function} cb callback(error, results)
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
 * @param  {string} key property
 * @param  {array} arr array of object
 * @return {array}     list of values
 */
function getValues(key, arr) {
    //arr > array of objects
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
 * @param  {string}   ref key from obj
 * @param  {Function} cb  callback(error, results)
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
 * updates site information
 * @param  {string}   ref     reference to site db
 * @param  {object}   newInfo new content to update with
 * @param  {Function} cb      callback(error, results)
 */
// function updateSite(ref, newInfo, cb) {
//     mongo.connect(mongoUri, function(err, db) {
//         if (err) return cb(err);
//         db.collection('sites', function(err, c) {
//             if (err) return cb(err);
//             //this may overwrite document! be careful
//             c.update({
//                 ref: ref
//             }, {
//                 $set: newInfo
//             }, function(err, res) {
//                 if (err) {
//                     return cb(err);
//                 } else {
//                     cb(null, res);
//                 }
//             });
//         });
//     });
// }

function updateSite(query, newInfo, cb) {
    newInfo.updated = new Date();   //add updated time
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



//helper function to grab correct item
// function getMockItem(items, type, title) {
//     return items.reduce(function(p, c, i, arr) {
//         if (c.type === type && c.title === title) {
//             //found it
//             p.push(c);
//         }
//         return p;
//     }, []);
// }

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
 *
 * @param  {Object}   query
 * @param  {Function} cb    >callback(err, data)
 *
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
 *
 * @param {String}   ref
 * @param {Object}   item
 * @param {Function} cb   >callback(err)
 *
 * @return {Function}
 */
function addItem(query, item, cb) {
    item.ref = query.ref; //item needs to include ref
    item.created = new Date();  //add creation time
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
 *
 * @param  {String}   ref
 * @param  {String}   type    >type of item
 * @param  {String}   title   >title of item
 * @param  {Object}   newItem
 * @param  {Function} cb      >callback(err, data)
 *
 * @return {Function}
 */
function updateItem(query, newItem, cb) {
    newItem.updated = new Date();   //include updated time
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


//find and update item
// function updateItem(items, type, title, newItem) {
//     var updated = false;
//     items.forEach(function(item, index, arr) {
//         if (item.type === type && item.title === title) {
//             extendObj(item, newItem);
//             updated = true;
//         }
//     });
//     return updated;
// }

// //find and delete item
// function deleteItem(items, type, title) {
//     var deleted = false;
//     items.forEach(function(item, index, arr) {
//         if (item.type === type && item.title === title) {
//             //delete
//             arr.splice(index, 1);
//             deleted = true;
//         }
//     });
//     return deleted;
// }

/**
 * remove item
 *
 * @param  {Object}   query
 * @param  {Function} cb
 *
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

//check if item with type & title already exists
function checkExists(items, type, title) {
    return items.some(function(item) {
        return item.type === type && item.title === title;
    });
}

//add & update properties
function extendObj(obj1, obj2) {
    for (var key in obj2) {
        if (obj2.hasOwnProperty(key) && obj2[key]) {
            obj1[key] = obj2[key];
        }
    }
}

/**
 * DATABASE PLAN
 *
 * [SITE]
 *     ->url
 *     ->ref
 *     ->admin
 *     ->visited
 *     ->created
 *     ->security
 *
 * [ITEM]
 *     ->ref
 *     ->type
 *     ->name
 *     ->content
 *     ->date
 *
 */


/*==========  mock database  ==========*/
// mongo.connect(mongoUri, function(err, db){
//     if(err) throw err;
//     db.collection('site', function(err, c){
//         if(err) throw err;
//         c.insert({
//             url: 'joshmu.com',
//             ref: 'mu',
//             admin: 'Josh Mu',
//             visited: new Date(),
//             created: new Date(),
//             security: false
//         }, function(err, res){
//             if(err) throw err;
//             console.log('mu inserted', res);
//         });
//         c.insert({
//             url: 'jesswong.com.au',
//             ref: 'wong',
//             admin: 'Josh Mu',
//             visited: new Date(),
//             created: new Date(),
//             security: false
//         }, function(err, res){
//             if(err) throw err;
//             console.log('wong inserted', res);
//         });
//     });
// });



//mongo accepts bulk insert with array
//let create an initial items array

// var db_items = [{
//     ref: 'mu',
//     type: 'about',
//     title: 'About Me',
//     content: 'This is info about me, blah blah blah.'
// }, {
//     ref: 'mu',
//     type: 'contact',
//     title: 'My Contact Info',
//     content: '119A Seaforth Cres, Seaforth, NSW 2092'
// }, {
//     ref: 'wong',
//     type: 'about',
//     title: 'Info on Me!',
//     content: 'Did you know I can dance!?'
// }, {
//     ref: 'wong',
//     type: 'article',
//     title: 'Time to start moving',
//     content: 'It\'s that year again where we should all get up off the couch and start moving around!  Let\'s eat healthy and happily!'
// }, {
//     ref: 'wong',
//     type: 'contact',
//     title: 'Message me',
//     content: 'jesslmwong@gmail.com'
// }];

// mongo.connect(mongoUri, function(err, db) {
//     if (err) throw err;
//     db.collection('item', function(err, c) {
//         if (err) throw err;
//         c.insert(db_items, function(err, res){
//             if(err) throw err;
//             console.log('items added', res);
//         });
//     });
// });

// var mu = {
//     ref: 'mu',
//     url: 'joshmu.com',
//     title: 'Mu',
//     items: [{
//         type: 'about',
//         title: 'About Me',
//         content: 'This is info about me, blah blah blah.'
//     }, {
//         type: 'contact',
//         title: 'My Contact Info',
//         content: '119A Seaforth Cres, Seaforth, NSW 2092'
//     }]
// };

// mongo.connect(mongoUri, function(err, db){
//     if(err) throw err;
//     var collection = db.collection('wong');
//     collection.insert(wong, function(err, res){
//         if(err) throw err;
//         console.log('saved.', res);
//     });
// });

// new Site({
//     ref: 'wong',
//     url: 'jesswong.com.au',
//     title: 'JESS WONG',
//     items: [{
//         type: 'about',
//         title: 'Info on Me!',
//         content: 'Did you know I can dance!?'
//     }, {
//         type: 'article',
//         title: 'Time to start moving',
//         content: 'It\'s that year again where we should all get up off the couch and start moving around!  Let\'s eat healthy and happily!'
//     }, {
//         type: 'contact',
//         title: 'Message me',
//         content: 'jesslmwong@gmail.com'
//     }]
// }).save(function(err, docs){
//     console.log(err || 'success');
//     console.log(docs);
// });

// var wong = {
//     ref: 'wong',
//     url: 'jesswong.com.au',
//     title: 'JESS WONG',
//     items: [{
//         type: 'about',
//         title: 'Info on Me!',
//         content: 'Did you know I can dance!?'
//     }, {
//         type: 'article',
//         title: 'Time to start moving',
//         content: 'It\'s that year again where we should all get up off the couch and start moving around!  Let\'s eat healthy and happily!'
//     }, {
//         type: 'contact',
//         title: 'Message me',
//         content: 'jesslmwong@gmail.com'
//     }]
// };

// var db = {
//     'mu': mu,
//     'wong': wong
// };









/*================================
=            mongoose            =
================================*/
//https://devcenter.heroku.com/articles/nodejs-mongoose

// var mongoose = require('mongoose');
// /* connect */
// var mongoUri = process.env.MONGOLAB_URI ||
//     process.env.MONGOHQ_URL ||
//     'mongodb://localhost/test-api';

// mongoose.connect(mongoUri);

// var ItemSchema = mongoose.Schema({
//     type: String,
//     title: String,
//     content: String
// });

// /* schemas */
// var SiteSchema = mongoose.Schema({
//     ref: String, //specified by admin
//     url: String,
//     title: String,
//     items: [ItemSchema]
// });


// /* model */
// var Site = mongoose.model('Site', SiteSchema);
// var Item = mongoose.model('Item', ItemSchema);



// function getItem(ref, type, title, cb) {
//     Site
//         .findOne({
//             'ref' : ref,
//             'items.type' : type,
//             'items.title' : title
//         })
//         .select('items.$')  //TODO: what does $ mean?
//         .exec(function(err, docs){
//             if(err) throw err;
//             //result is filtered down there should only be 1 item returned in items array
//             var item = docs.items[0];
//             cb(item);
//         });
// }

/*========================
=                        =
========================*/
