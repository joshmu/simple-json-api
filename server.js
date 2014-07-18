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
    req.api_ref = ref;
    next();
});

app.route('/:ref')
    .get(function(req, res) {
        getSite(req.api_ref, function(err, site) {
            res.json(err ? err.message : site);
        });
    })
    .post(function(req, res) {
        res.json({
            error: 'Cannot add another title.'
        });
    })
    .put(function(req, res) {
        var newInfo = req.body;
        updateSiteInfo(req.api_ref, newInfo, function(err){
            if(err) {
                res.json({
                    error: err.message
                });
            } else {
                res.json({
                    message: 'Site information udpated.'
                });
            }
        });


        // console.log('updating ref title');
        // var title = req.body.title;
        // console.log('req body > ', req.body);
        // ref[req.api_ref].title = title;
        // res.json({
        //     message: 'Title has been updated.'
        // });
    });

//TODO: this is where i am upto !
app.route('/:ref/items')
    .get(function(req, res) {
        res.json(ref[req.api_ref].items);
    })
    .post(function(req, res) {
        var item = req.body;
        var items = ref[req.api_ref].items;
        if (!checkExists(items, item.type, item.title)) {
            ref[req.api_ref].items.push(item);
            res.json({
                message: 'item has been added.'
            });
        }
    });

app.param('type', function(req, res, next, type) {
    req.type = type;
    next();
});

app.param('title', function(req, res, next, title) {
    req.title = title;
    next();
});

app.route('/:ref/items/:type/:title')
    .get(function(req, res) {
        // var item = getMockItem(ref[req.api_ref].items, req.type, req.title);
        //res.json(item);
        getItem(req.api_ref, req.type, req.title, function(err, data) {
            if (err) {
                res.json({
                    error: 'Cannot find item.'
                });
            } else {
                res.json(data);
            }
        });
    })
    .put(function(req, res) {
        var items = ref[req.api_ref].items;
        var newItem = req.body;
        var checkUpdate = updateItem(items, req.type, req.title, newItem);
        if (checkUpdate) {
            res.json({
                message: 'Item updated.'
            });
        } else {
            res.json({
                message: 'Item not found.'
            });
        }
    })
    .delete(function(req, res) {
        var items = ref[req.api_ref].items;
        var checkDelete = deleteItem(items, req.type, req.title);
        if (checkDelete) {
            res.json({
                message: 'Item deleted.'
            });
        } else {
            res.json({
                message: 'Item not found.'
            });
        }
    });

server.listen(app.get('port'), function(err) {
    console.log(err || 'Connected on ' + app.get('port'));
});


/**
 * retrieve  info on all sites
 * @param  {Function} cb callback(error, results)
 */
function showSites(cb) {
    mongo.connect(mongoUri, function(err, db) {
        if (err) return cb(err);
        db.collection('site')
            .find()
            .toArray(function(err, res) {
                if (err) {
                    cb(err);
                } else {
                    cb(null, res);
                }
                db.close();
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
function getSite(ref, cb) {
    mongo.connect(mongoUri, function(err, db) {
        if (err) return cb(err);
        db.collection('site', function(err, c) {
            if (err) return cb(err);
            c.find({
                ref: ref
            }).toArray(function(err, res) {
                if (err) return cb(err);
                cb(null, res);
                db.close();
            });
        });
    });
}


/**
 * updates site information
 * @param  {string}   ref     reference to site db
 * @param  {object}   newInfo new content to update with
 * @param  {Function} cb      callback(error, results)
 */
function updateSiteInfo(ref, newInfo, cb){
    mongo.connect(mongoUri, function(err, db){
        if(err) return cb(err);
        db.collection('site', function(err, c){
            if(err) return cb(err);
            //this may overwrite document! be careful
            c.update({ref : ref}, {$set: newInfo}, function(err, res){
                if(err) {
                    return cb(err);
                } else {
                    cb(null, res);
                }
            });
        });
    });
}

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

function getItem(ref, type, title, cb) {
    mongo.connect(mongoUri, function(err, db) {
        if (err) {
            cb(err);
            return;
        }
        db.collection('item')
            .find({
                ref: ref,
                type: type,
                title: title
            }).toArray(function(err, results) {
                if (err) {
                    cb(err);
                } else {
                    cb(null, results);
                }
                db.close();
            });
    });
}

//find and update item
function updateItem(items, type, title, newItem) {
    var updated = false;
    items.forEach(function(item, index, arr) {
        if (item.type === type && item.title === title) {
            extendObj(item, newItem);
            updated = true;
        }
    });
    return updated;
}

//find and delete item
function deleteItem(items, type, title) {
    var deleted = false;
    items.forEach(function(item, index, arr) {
        if (item.type === type && item.title === title) {
            //delete
            arr.splice(index, 1);
            deleted = true;
        }
    });
    return deleted;
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
 *     ->dbRef
 *     ->admin
 *     ->visited
 *     ->created
 *     ->security
 *
 * [ITEM]
 *     ->dbRef
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

var mu = {
    ref: 'mu',
    url: 'joshmu.com',
    title: 'Mu',
    items: [{
        type: 'about',
        title: 'About Me',
        content: 'This is info about me, blah blah blah.'
    }, {
        type: 'contact',
        title: 'My Contact Info',
        content: '119A Seaforth Cres, Seaforth, NSW 2092'
    }]
};

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

var wong = {
    ref: 'wong',
    url: 'jesswong.com.au',
    title: 'JESS WONG',
    items: [{
        type: 'about',
        title: 'Info on Me!',
        content: 'Did you know I can dance!?'
    }, {
        type: 'article',
        title: 'Time to start moving',
        content: 'It\'s that year again where we should all get up off the couch and start moving around!  Let\'s eat healthy and happily!'
    }, {
        type: 'contact',
        title: 'Message me',
        content: 'jesslmwong@gmail.com'
    }]
};

var db = {
    'mu': mu,
    'wong': wong
};









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
