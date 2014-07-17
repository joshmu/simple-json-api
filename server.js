var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser = require('body-parser');

var app = express();
var server = http.createServer(app);
var port = 3000;

app.set('port', port || process.env.PORT);
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
 * /[site]
 * GET > return all results
 * POST > add 'title'
 * PUT > change 'title'
 *
 * /[site]/items
 * GET > return 'items'
 * POST > add 'item'
 *
 * /[site]/items/[type]/[name]
 * GET > get specific item
 * EDIT > edit specific item of 'type' & 'name'
 * DELETE > delete specific item of 'type' & 'name' (use mongo _id later)
 *
 **/
app.get('/', function(req, res) {
    var sites = [];
    for (var key in db) {
        if (db.hasOwnProperty(key)) {
            sites.push(key);
        }
    }
    res.json({
        message: 'This is Mu\'s api, you better know what you are doing.',
        sites: sites
    });
});

app.param('site', function(req, res, next, site) {
    req.site = site;
    next();
});

app.route('/:site')
    .get(function(req, res) {
        var site = req.site;
        res.json(db[site]);
    })
    .post(function(req, res) {
        res.json({
            message: 'Cannot add another title.'
        });
    })
    .put(function(req, res) {
        console.log('updating site title');
        var title = req.body.title;
        console.log('req body > ', req.body);
        db[req.site].title = title;
        res.json({
            message: 'Title has been updated.'
        });
    });

app.route('/:site/items')
    .get(function(req, res) {
        res.json(db[req.site].items);
    })
    .post(function(req, res) {
        var item = req.body;
        var items = db[req.site].items;
        if (!checkExists(items, item.type, item.name)) {
            db[req.site].items.push(item);
            res.json({
                message: 'item has been added.'
            });
        }
    });

app.param('type', function(req, res, next, type) {
    req.type = type;
    next();
});

app.param('name', function(req, res, next, name) {
    req.name = name;
    next();
});

app.route('/:site/items/:type/:name')
    .get(function(req, res) {
        var item = getItem(db[req.site].items, req.type, req.name);
        res.json(item);
    })
    .put(function(req, res) {
        var items = db[req.site].items;
        var newItem = req.body;
        var checkUpdate = updateItem(items, req.type, req.name, newItem);
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
        var items = db[req.site].items;
        var checkDelete = deleteItem(items, req.type, req.name);
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
function getItem(items, type, name) {
    return items.reduce(function(p, c, i, arr) {
        if (c.type === type && c.name === name) {
            //found it
            p.push(c);
        }
        return p;
    }, []);
}

//find and update item
function updateItem(items, type, name, newItem) {
    var updated = false;
    items.forEach(function(item, index, arr) {
        if (item.type === type && item.name === name) {
            extendObj(item, newItem);
            updated = true;
        }
    });
    return updated;
}

//find and delete item
function deleteItem(items, type, name) {
    var deleted = false;
    items.forEach(function(item, index, arr) {
        if (item.type === type && item.name === name) {
            //delete
            arr.splice(index, 1);
            deleted = true;
        }
    });
    return deleted;
}

//check if item with type & name already exists
function checkExists(items, type, name) {
    return items.some(function(item) {
        return item.type === type && item.name === name;
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

var mu_site = {
    site: 'joshmu.com',
    name: 'Mu',
    items: [{
        type: 'about',
        name: 'About Me',
        content: 'This is info about me, blah blah blah.'
    }, {
        type: 'contact',
        name: 'My Contact Info',
        content: '119A Seaforth Cres, Seaforth, NSW 2092'
    }]
};

var wong_site = {
    site: 'jesswong.com.au',
    name: 'JESS WONG',
    items: [{
        type: 'about',
        name: 'Info on Me!',
        content: 'Did you know I can dance!?'
    }, {
        type: 'article',
        name: 'Time to start moving',
        content: 'It\'s that year again where we should all get up off the couch and start moving around!  Let\'s eat healthy and happily!'
    }, {
        type: 'contact',
        name: 'Message me',
        content: 'jesslmwong@gmail.com'
    }]
};

var db = {
    'mu': mu_site,
    'wong': wong_site
};

/*================================
=            mongoose            =
================================*/
// var mongoose = require('mongoose');
// /* connect */
// mongoose.connect('mongodb://localhost/test-api');

// /* schemas */
// var SiteSchema = mongoose.Schema({
//     site: String,    //specified by the api admin
//     title: String,
//     items: [{
//         type: String,
//         name: String,
//         content: String,
//         date: Date
//     }]
// });

// /* model */
// var Site = mongoose.model('Site', SiteSchema);
