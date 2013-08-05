//
// Dreamy_mongo.js
// A set of scripts to help connect to dreamy, a CGI version
// of SleepyMongoose.
// Dreamy provides a RESTful interface to MongoDB.

// Pull the live version of the project.

// see https://github.com/10gen-labs/sleepy.mongoose/wiki
// for details.

// Subclass of ABoundObject.
DreamyScan.prototype = new ABoundObject(null);           

function DreamyScan( element, options )
{
  ///
  /// Constructor.
  ///
  if(!element) return;

  // Options - defaults. Sensible for a wide range of stuff.  
  var defaults = {
    dreamy_url: "scan/dreamy.cgi"
    ,experiment: 'uboone'
    ,project:    'tscans'
    ,password:   null
    ,user_name:  "Anonymous Coward"
    ,demand_username: true // dialog requres username.
    ,load_form_from_db: false
  };
  // override defaults with options.
  $.extend(true,defaults,options);

  // Override with configuration from the element
  ABoundObject.call(this, element, defaults); // Give settings to ABoundObject contructor.

  // Override with cookies.
  // Requires jquery cookies plugin.
  if($.cookie("dreamy-user-name"))  this.user_name  = $.cookie("dreamy-user-name")
  if($.cookie("dreamy-password"))   this.password   = $.cookie("dreamy-password")
  if($.cookie("dreamy-experiment")) this.experiment = $.cookie("dreamy-experiment")
  if($.cookie("dreamy-project"))    this.project    = $.cookie("dreamy-project")
  
  // Override with URL data.
  var url_param = $.deparam.querystring(); // Requires jquery bbq plugin
  if(url_param.experiment) this.experiment = url_param.experiment;
  if(url_param.project)   this.project     = url_param.project;
  if(url_param.user_name) this.user_name   = url_param.user_name;
  if(url_param.password)  this.password   = url_param.password;

  var self = this;

  // Deal with login issues.
  $('input.dreamy-username-input',this.element).keydown(function(ev) { 
    if (ev.keyCode == '13') {
      self.LoginAs($(this).val()); 
    }
  });
  $('.dreamy-change-username-button',this.element).click(function() {
    $(".dreamy-username-input",self.element).val(self.user_name);
    $(self.element).block({ message: $('div.dreamy-login-form',self.element), css: {width: '50%'} });
  });
  
  if(this.demand_username && this.user_name == "Anonymous Coward") {
    $(this.element).block({ message: $('div.dreamy-login-form',this.element), css: {width: '50%'} });
  } else {
    $(".dreamy-username",this.element).html(this.user_name);
  }      
  this.event_id = {};
  this.event_checksum = {};
  
  if(this.load_form_from_db) this.retrieve_scan_form();
  else this.reset_form();
  
  // Event handlers:
  // submit button
  $(".dreamy-scan-form-submit-button",this.element).button().click(this.submit_form.bind(this));
  $(".dreamy-scan-form-submit-and-advance-button",this.element).button()
  .click(function(){      
      self.submit_form();
      self.advance_to_next_inbox();
    });
  // submit-and-advance-inbox button
  // Add this event to interesting events button
  // Add this event to inbox button
  
}

DreamyScan.prototype.LoginAs = function( user )
{
  console.warn("LoginAs",user);
  this.user_name = user;
  $.cookie("dreamy-user-name",this.user_name);
  $(".dreamy-username",this.element).html(this.user_name);
  $(this.element).unblock();
}


DreamyScan.prototype.event_match_query = function( )
{
  // Override to form a query between the current event and something in the db.
  var query = {
    type:'scan',
  };
  query.event_id = this.event_id;  
  return query;
}


// Functions for dealing primary with scanner entry

DreamyScan.prototype.set_event_id = function( event_id, checksum )
{
  // Needs to be called by the sub-class on NewRecord or slice change or equivalent: whenever 
  // the current event coordinates are changed, this needs to be given a record indicating what the current event is.
  this.event_id = event_id;
  this.event_checksum = event_checksum;
}

DreamyScan.prototype.reset_form = function(  )
{
  $('form.dreamy-scan-form',this.element).each(function(){this.reset()});
  this.empty_form_values = this.read_form_values();
}



DreamyScan.prototype.read_form_values = function(  )
{
  //Compose result.
  
  // Scan form.
  var scan = {};
  var serial = $('form.dreamy-scan-form',this.element).serializeArray();
  for(var i=0;i<serial.length;i++) {
    var s = serial[i];
    var val = parseFloat(s.value)
    scan[s.name] = isNaN(val)?s.value:val;
  };
  // Add unchecked checkboxes.
  $('form.dreamy-scan-form input:checkbox:not(:checked)',this.element).each(function(){
    scan[this.name]=0;
  })
  return scan;
}

DreamyScan.prototype.submit_form = function(  )
{
  // Get the form data.
  var scan = this.read_form_values();
  
  // Is this form the same as an un-dirtied one? If so, warn.
  if( JSON.stringify(scan) === JSON.stringify(this.empty_form_values) ) {
    var r=confirm("It looks like you haven't touched the scan form. Are you sure you want to submit this empty form?");
    if (!r) return;
  } 
  
  //Compose result.
  var doc = {
    type: 'scan',
    scan: this.read_form_values(),
    event_id: this.event_id,
    checksum: this.event_checksum,
    scan_id: { user_name: this.user_name, modification_date: new Date() }
  };
  
  
  var args = { func: "_insert"
             , db: this.experiment
             , col: this.project
             , docs: JSON.stringify([doc])
           };
           
  var self = this;
  console.log("inserting ",doc);
  $.ajax({url: 'scan/dreamy.cgi'
      , type:'POST'
      , dataType: "json"
      , data: args
      ,  error: function(jqXHR, textStatus, errorThrown) { 
              self.do_error("Failure to send scan result! "+textStatus+" "+errorThrown);
      }
      ,  success: function(response) { 
          console.log("insert_success",response);
          if(!response.oids || response.oids.length<1) self.do_error("Failure to send scan result! DB error. "+response.errmsg);
          self.retrieve_scan_results();
      }
      });
}

DreamyScan.prototype.advance_to_next_inbox = function(  )
{
}



DreamyScan.prototype.retrieve_scan_form = function()
{
  var query = { type:'scanform', scanform: {"$exists":true}}; // find the scanner form document(s)
  var args = { func: "_find"
             , db: this.experiment
             , col: this.project
             , batch_size: 5
             , limit: 1                        /// only need the lastest version
             , criteria: JSON.stringify(query)  
             , fields: JSON.stringify(["scanform"]) // Just get the form data
             , sort: JSON.stringify({"_id":-1}) // Get the most recent
            
           };
   $.ajax({url: this.dreamy_url
       , type:'GET'
       , dataType: "json"
       , data: args
       , success: this.retrieve_scan_form_callback.bind(this)
     });
}


DreamyScan.prototype.retrieve_scan_form_callback = function(response)
{
  if(response.ok && response.results && response.reults.length>0) {
    $('.dreamy-scan-form',this.element).html(response.results[0].scanform);  
    this.reset_form();
  } else {
    this.do_error("Couldn't retrieve the scanning form.")
  }
}


//
// Functions for seeing the results of previous scanners.
//

DreamyScan.prototype.retrieve_scan_results = function()
{
  var query = this.event_match_query();
  console.warn("retrieve_scan_results",query);
  var args = { func: "_find"
             , db: this.experiment
             , col: this.project
             , batch_size: 999
             , criteria: JSON.stringify(query)  
             , sort: JSON.stringify({"_id":-1}) // Sort by recent
            
           };
   $.ajax({url: this.dreamy_url
       , type:'GET'
       , dataType: "json"
       , data: args
       , success: this.retrieve_scan_results_callback.bind(this)
     });
}


DreamyScan.prototype.object_to_table = function(obj)
{
  var r;
  r = "<table>";
  for(var k in obj) {
    r+="<tr><td>"+k+"</td><td>";
    if( Object.prototype.toString.call( obj[k] ) === '[object Object]' ) r+= this.object_to_table( obj[k] );
    else r+= obj[k]
    r+= "</td></tr>"  
  }
  r+= "</table>";
  return r;
}

DreamyScan.prototype.retrieve_scan_results_callback = function(response)
{
  console.warn("DreamyScan.retrieve_scan_results_callback",response);
  // Simple dump.
  var list = []
  if(!response.results) return;
   gScanResults = response.results;
  for(var i=0;i<response.results.length;i++){
    var doc = response.results[i];
    var date = new Date(doc.scan_id.modification_date);
    var r = "<span class='collapsible-title'>"+doc.scan_id.user_name+" " + date.toLocaleString()+'</span>';
    r+= "<div class='collapsible'><table>";
    r+= this.object_to_table(doc);

    r += "</div>";
    list.push(r);
  } 

  $('div.dreamy-scan-results',this.element).html(
    "<h4>Previous Scans Of This Event</h4>"+
    list.join("<hr>"));  
  $("div.dreamy-scan-results .collapsible-title",this.element)
    .addClass('ui-helper-clearfix').prepend('<span class="collapsible-icon ui-icon ui-icon-triangle-1-s" />')
    .click(function(){
                           $(".collapsible-icon",this).toggleClass('ui-icon-triangle-1-e')
                                                      .toggleClass('ui-icon-triangle-1-s');
                           $(this).next().toggle();                       
                         })
                         .click();
  
}



DreamyScan.prototype.do_error = function( msg )
{
  var dialog = $(".error-dialog",this.element);
  if(dialog.length == 0) {
    dialog = $("<div class='error-dialog'></div>");
    $(this.element).append(dialog);    
    dialog = $(".error-dialog",this.element);
  }
  dialog.html(msg);
  $(dialog).dialog({
          modal: true,
          buttons: { Ok: function() {$( this ).dialog( "close" );} }
    });
}

