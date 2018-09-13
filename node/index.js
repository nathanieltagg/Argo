var http = require('http');
var https = require('https');
var express = require('express');
var expressSession = require('express-session');
var bodyParser = require('body-parser');
var path = require('path');
var ssi = require("ssi");
var argo = require('./build/Release/argo-backend-node');
var app = express();

var includes = new ssi("../", "compiled/", "*.html)");
includes.compile();
app.use('/',express.static(path.join(__dirname,'compiled')));
app.use('/',express.static(path.join(__dirname,'..')));
app.use('/core',express.static(path.join(__dirname,'../core')));
app.use('/libs',express.static(path.join(__dirname,'../libs')));
app.use('/css',express.static(path.join(__dirname,'../css')));
app.use('/shaders',express.static(path.join(__dirname,'../shaders')));
app.use('/js',express.static(path.join(__dirname,'../js')));
app.use('/images',express.static(path.join(__dirname,'../images')));
app.use('/server',express.static(path.join(__dirname,'../server')));

var event = argo.compose_async(
                        {options:""
  ,filename:"../server/prodgenie_bnb_nu_uboone_0_20150624T190300_gen_24692207-4e24-4da0-b7b1-7fb650d6f7ad_20150625T232049_g4_20150628T171600_detsim_20150629T013741_reco1_20150629T210030_reco2.root"
                        ,selection:"1"
                        ,entrystart:0
                        },
                        function(result){
                          var record = JSON.parse(result);
                          console.log("Got record",record);
                          //QuerySuccess({record:record});
                        }
                      );

http.createServer(app).listen(8841); 