var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser = require('body-parser');


/*================================
=            mongoose            =
================================*/
//https://devcenter.heroku.com/articles/nodejs-mongoose

var mongoose = require('mongoose');
/* connect */
var mongoUri = process.env.MONGOLAB_URI ||
    process.env.MONGOHQ_URL ||
    'mongodb://localhost/test-api';

mongoose.connect(mongoUri);

var ItemSchema = mongoose.Schema({
    type: String,
    title: String,
    content: String
});

/* schemas */
var SiteSchema = mongoose.Schema({
    dbName: String, //specified by admin
    url: String,
    title: String,
    items: [ItemSchema]
});


/* model */
var Site = mongoose.model('Site', SiteSchema);
var Item = mongoose.model('Item', ItemSchema);

/*========================
=                        =
========================*/


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
 * /[dbName]
 * GET > return all results
 * POST > add 'title'
 * PUT > change 'title'
 *
 * /[dbName]/items
 * GET > return 'items'
 * POST > add 'item'
 *
 * /[dbName]/items/[type]/[title]
 * GET > get specific item
 * EDIT > edit specific item of 'type' & 'title'
 * DELETE > delete specific item of 'type' & 'title' (use mongo _id later)
 *
 **/
app.get('/', function(req, res) {
    var dbNames = [];

    // Site.find(function())

    for (var key in dbName) {
        if (dbName.hasOwnProperty(key)) {
            dbNames.push(key);
        }
    }
    res.json({
        message: 'This is Mu\'s api, you better know what you are doing.',
        dbNames: dbNames
    });
});

app.param('dbName', function(req, res, next, dbName) {
    req.dbName = dbName;
    next();
});

app.route('/:dbName')
    .get(function(req, res) {
        var dbName = req.dbName;
        res.json(dbName[dbName]);
    })
    .post(function(req, res) {
        res.json({
            message: 'Cannot add another title.'
        });
    })
    .put(function(req, res) {
        console.log('updating dbName title');
        var title = req.body.title;
        console.log('req body > ', req.body);
        dbName[req.dbName].title = title;
        res.json({
            message: 'Title has been updated.'
        });
    });

app.route('/:dbName/items')
    .get(function(req, res) {
        res.json(dbName[req.dbName].items);
    })
    .post(function(req, res) {
        var item = req.body;
        var items = dbName[req.dbName].items;
        if (!checkExists(items, item.type, item.title)) {
            dbName[req.dbName].items.push(item);
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

app.route('/:dbName/items/:type/:title')
    .get(function(req, res) {
        // var item = getMockItem(dbName[req.dbName].items, req.type, req.title);
        //res.json(item);
        getItem(req.dbName, req.type, req.title, function(data) {
            res.json(data);
        });
    })
    .put(function(req, res) {
        var items = dbName[req.dbName].items;
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
        var items = dbName[req.dbName].items;
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


//helper function to grab correct item
function getMockItem(items, type, title) {
    return items.reduce(function(p, c, i, arr) {
        if (c.type === type && c.title === title) {
            //found it
            p.push(c);
        }
        return p;
    }, []);
}

function getItem(dbName, type, title, cb) {
    Site
        .findOne({
            'dbName' : dbName,
            'items.type' : type,
            'items.title' : title
        })
        .select('items.$')  //TODO: what does $ mean?
        .exec(function(err, docs){
            if(err) throw err;
            //result is filtered down there should only be 1 item returned in items array
            var item = docs.items[0];
            cb(item);
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

//TODO: not able to add more than one contact, about etc?

//add & update properties
function extendObj(obj1, obj2) {
    for (var key in obj2) {
        if (obj2.hasOwnProperty(key) && obj2[key]) {
            obj1[key] = obj2[key];
        }
    }
}

/*==========  mock database  ==========*/

var mu = {
    dbName: 'mu',
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

// new Site({
//     dbName: 'wong',
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
    dbName: 'wong',
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
