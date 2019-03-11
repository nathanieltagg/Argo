"use strict";
//
// Functions to handle micrboone json data.
//


// Global selected objects!
// FIXME: put somewhere useful
function GetSelectedName(_type)
{
  // Returns name of currently selected version of object _type (i.e. _type=hits, _name=gaushits)
  // Returns undefined if no such object has been selected, or if it selected but not loaded.
  var _name = $('input[name="ctl-select-'+_type+'"]:checked').val();
  if(gRecord && gRecord[_type] && gRecord[_type][_name]) return _name;
  return undefined;
}

function GetSelected(_type) 
{
  var _name = GetSelectedName(_type);
  if(_name) return gRecord[_type][_name];
  return [];
}

// Automatic runtime configuration.
$(function(){
  $('#ControlOverlay').each(function(){
    gControlOverlay = new ControlOverlay(this);
  });  
});

// // Things the user is likely to want to see, based on recent history.  Save this in a cookie or something.
// gDesires = {
//   hits: { active: true, name: "gaushit" },
// }




var gControlOverlay = null;


function ControlOverlay( element )
{
  this.element = element;
  var settings = {
  };
  $.extend(true,this,settings);
  
  // Merge in options from element
  var element_settings = $(element).attr('settings');
  var element_settings_obj={};
  if(element_settings) {
    eval( "var element_settings_obj = { " + element_settings + '};'); // override from 'settings' attribute of html object.
    // console.log(element_settings, element_settings_obj);
    $.extend(true,this,element_settings_obj); // Change default settings by provided overrides.
  }
  this.bar_ul = $('.data-product-bar ul',this.element);
  
  this.bar_ul.on("change","input.product-type",this.OnChangeProductTypeToggle.bind(this))
  this.bar_ul.on("change","input.product-name",this.OnChangeProductName.bind(this))

  $('.progress-status',this.element).on("click",function(){
    $("#progresslog-modal").show();
  })

  $('.file-and-entry',this.element).on("click",function(){
    $("#input-fe").show();
  });

  $('.event-id-info',this.element).on("click",function(){
    $("#input-rawrun").show();
  });


  gStateMachine.Bind('newRecord',this.NewRecord.bind(this));
  gStateMachine.Bind('newPiece',this.NewPiece.bind(this));
  this.event_descriptor = "invalid!!111!!";
}


ControlOverlay.prototype.NewRecord = function()
{
  this.bar_ul.empty(); // The rest is taken care of below.
  this.waiting_for_manifest = true;
}


ControlOverlay.prototype.NewPiece = function(piece)
{
  // console.log("ControlOverlay::NewPiece()");
  function simpleName(prod){ if(prod.includes('__')) return prod.split('_')[1]; else return prod; }
  function nameToTitle(prod){ var v = prod.split('_'); return "Type: "+v[0] + " Name: " + v[1] + " Process: " + v[3]; };
  function noColons(prod) {return prod.replace(/:/g,'');}
  // console.warn("ControlOverlay Got a new piece",piece);
  
  // Called when a new piece arrives
  if(gRecord.manifest){
    if(this.waiting_for_manifest) {
      this.waiting_for_manifest = false;
      this.event_descriptor = gRecord.event_descriptor;
      // console.log("ControlOverlay: New manifest",this.event_descriptor,gRecord.event_descriptor);
      this.bar_ul.empty();
      var bar_ul = this.bar_ul;

      function add_type(_type) {
        console.log(_type);
        var elem = $('<li></li>').data("product-type",_type).addClass("product-type").hide();

        // var label = $('<label><label>').addClass('unretrieved').addClass('product-type').text(_type).data('product-type',_type); // move all labels to input.
        var label = $('<label><label>').text(_type).attr('for',"ctl-show-"+_type);
        var input = $('<input type="checkbox" />')
              .addClass('product-type')
              .addClass('unretrieved')
              .addClass('saveable auto-save-on-change')
              .addClass('show-'+_type)
              .data('product-type',_type)
              .attr("id","ctl-show-"+_type)
        elem.append(input);
        elem.append('<span class="checkmark"></span>');
        elem.append(label);
        
        var fs = $('<fieldset></fieldset>').addClass("dropdown");
        for(var _name in gRecord.manifest[_type]) {
          var div = $('<div></div>');
          var nlabel = $('<label></label>').attr('for','product-'+noColons(_name)).text(simpleName(_name));
            // .addClass('unretrieved')
            // .addClass('product-name')
            // 
            // .data('product-name',_name)
            // .data('product-type',_type)
            // // .attr('title',nameToTitle(_name))
            // ;
          var ninput = $('<input type="radio"/>')
              .attr('id','product-'+noColons(_name))
              .attr('name','ctl-select-'+_type)
              .addClass('product-name')
              .addClass('unretrieved')
              .addClass('saveable auto-save-on-change')          
              .attr('value',_name)
              .data('product-name',_name)
              .data('product-type',_type);
            div.append(ninput).append('<span class="checkmark"></span>').append(nlabel);
            fs.append(div);
//           nlabel.append(ninput).append('<span class="checkmark"></span>');
//           fs.append(nlabel);
        }
        $('input.product-name',fs).prop("checked",false);
        elem.append(fs);

        elem.appendTo(bar_ul).show('slow');
        $('#'+_type+'-menu-info').appendTo(fs).show();
        
        // if(_type == "tracks") debugger;
      }

      // Default menu order:
      var menus = ['wireimg','hits','tracks','showers','particles','spacepoints','endpoint2d','ophits','oppulses','opflashes'];
      for( t of menus) { 
        if( t in gRecord.manifest ) add_type(t);
      }
      
      for( var t in gRecord.manifest ) {
        if(!menus.includes(t)) add_type(t);
      }
      
      RestoreControlSettings('save',this.bar_ul, true); // Sets everything on, off, but fires no change events.
      
      // It's now our job to do what is required. This is easy: go fetch anything that has the 'show' flag checked.
      $('input.product-type:checked').change();
      
      
    }
  } else {
    console.log("No Skeleton");
  }
  
  // Now look at the actual content. Look for new things by seeing if they've already been marked as retrieved.
  for(var _type in gRecord) {
    var product_type_elem =  $("li.product-type").filter(function(){return $(this).data('product-type')==_type;});
    var product_type_input = $("input.product-type",product_type_elem);
    if(product_type_elem.length==0) continue;

    var n_new =0;
    var n_retrieved_before = $("input.product-name.retrieved",product_type_elem).length;
    
    for(var _name in gRecord[_type]) {
      console.log("ControlOverlay: inspecting ",_type,_name);
      var item = $("input.product-name",product_type_elem).filter(function(){return $(this).data('product-name')==_name;});
      if(item.length==0) {
        // This wasn't in the manifest!
        console.error("Recieved data product that wasn't in the manifest");
        // can prepend it to fs
      }
      if(!item.hasClass('retrieved')) {
        n_new++;
        // This is a new piece.
        console.log("ControlOverlay: registered new item in the gRecord",_type,_name)
        item.removeClass('unretrieved').removeClass("pending").addClass('retrieved');
        if(GetSelectedName(_type)==_name) gStateMachine.Trigger('change-'+_type); // Make sure an event fires so that views see it's there now.
      }
      
    }
    
    var n_pending = $("input.product-name.pending",product_type_elem).length;
    console.warn("pending check",_type,n_pending);
    if(n_pending == 0) product_type_input.removeClass("pending");
    if(n_new>0) {
      // Turn on the product label.
      // product_type_label.removeClass('unretrieved').addClass('retrieved');
      // Pulse the label.
      product_type_input.removeClass('unretrieved');
      var label = product_type_input.siblings("label")[0];
      label.classList.remove("pulse");
      void label.offsetWidth; // allows pulse retriggering see https://codepen.io/chriscoyier/pen/EyRroJ
      label.classList.add("pulse");
    }
  }
}

ControlOverlay.prototype.Click = function(a,b,c)
{
  console.log("Click",a,b,c);
}

ControlOverlay.prototype.OnChangeProductTypeToggle = function(ev)
{
  // Toggle this type of thing on/off
  var tgt = $(ev.currentTarget);
  var _type = tgt.data('product-type');
  console.log("OnChangeProductType",_type);

  // FIXME better logic:
  // Do we have one selected and loaded?  use it (Simple on/off toggle)
  var _name = GetSelectedName(_type);
  if(_name && gRecord[_type] && gRecord[_type][_name]){ gStateMachine.Trigger('toggle-'+_type); return true; }

  function load_name(_name) {
    // if(!_name) debugger;
    console.log("OnChangeProductTypeToggle is triggering load of type",_type,"product",_name);
    var product_type_input =  $("input.product-name").filter(function(){return $(this).data('product-name')==_name;});
    product_type_input.prop('checked',true).trigger("change");  
  }

  // Selected but not loaded?  This happens if browser remembers the radio choice, but it hasn't been requested yet.
  _name = $('input[name="ctl-select-'+_type+'"]:checked').val()
  if(_name) {
    load_name(_name);
    return true;
  }  
  
  // None selected, but one loaded?  select it  (Shouldn't happen...?)
  var loaded = Object.keys(gRecord[_type] || {});
  if(loaded.length>0) {
    load_name(loaded[0]);
    return true;    
  }

  // none selected, none loaded?  Pick one at semi-random, load and select it.
  var possible = Object.keys(((gRecord || {}).manifest || {})[_type]||{});
  for(var _name of possible) {
    var select = false;
    if(  _name.includes("gaushit")
      || _name.includes("pandoraNu") 
      || _name.includes("pandoraCosmic") // I LIKE TRAFFIC LIGHTS I LIKE TRAFFIC LIGHTS
      ) {
        load_name(_name);
        return true;            
      }
  }

  // Still nothing?  OK, just pick the first goddamn thing in the list and get that.
  load_name(possible[0]);

  return true;
}

ControlOverlay.prototype.OnChangeProductName = function(ev)
{
  var tgt = $(ev.currentTarget);
  var _type = tgt.data('product-type');
  var _name = tgt.data('product-name');
  var product_type_input =  $("input.product-type").filter(function(){return $(this).data('product-type')==_type;});
  
  // do we have it?
  var thing = ((gRecord || {})[_type] || {})[_name];
  if(thing) // it exists
    gStateMachine.Trigger('change-'+_type);
  else {
    product_type_input.addClass("pending").prop("checked","checked"); // not no change event!
    tgt.addClass("pending");
    RequestPiece(_type,_name);
  }
  return true;
}


  