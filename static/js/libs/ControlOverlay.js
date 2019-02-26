"use strict;"
//
// Functions to handle micrboone json data.
//


// Global selected objects!
// FIXME: put somewhere useful
function GetSelectedName(_type)
{
  return  $('input[name="ctl-select-'+_type+'"]:checked').val();
}

function GetSelected(_type) 
{
  return (((gRecord || {})[_type] || {})[GetSelectedName(_type)]) || [];
}

// Automatic runtime configuration.
$(function(){
  $('#ControlOverlay').each(function(){
    gControlOverlay = new ControlOverlay(this);
  });  
});

// Things the user is likely to want to see, based on recent history.  Save this in a cookie or something.
gDesires = {
  hits: { active: true, name: "gaushit" },
}




gControlOverlay = null;


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
  
  this.bar_ul.on("change","input.product-type",this.OnChangeProductType.bind(this))
  this.bar_ul.on("change","input.product-name",this.OnChangeProductName.bind(this))


  gStateMachine.BindObj('newRecord',this,"NewRecord");
  gStateMachine.BindObj('newPiece',this,"NewPiece");
  this.event_descriptor = "invalid!!111!!";
}


ControlOverlay.prototype.NewRecord = function()
{
  this.bar_ul.empty(); // The rest is taken care of below.
}


ControlOverlay.prototype.NewPiece = function()
{
  
  function simpleName(prod){ return prod.split('_')[1]; }
  function nameToTitle(prod){ var v = prod.split('_'); return "Type: "+v[0] + " Name: " + v[1] + " Process: " + v[3]; };
  
  
  // Called when a new piece arrives
  if(gRecord.skeleton){
    // Is it new?  Use the event_descriptor
    // FIXME: look for the new newRecord event
    // var sskel =JSON.stringify(gRecord.skeleton);
    // if(JSON.stringify(gRecord.skeleton) != this.skeleton_json) {
    if(gRecord.event_descriptor != this.event_descriptor) {
      console.log("ControlOverlay: New skeleton",this.event_descriptor,gRecord.event_descriptor);
      this.event_descriptor = gRecord.event_descriptor;
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
              .addClass('saveable auto-save')
              .addClass('show-'+_type)
              .data('product-type',_type)
              .attr("id","ctl-show-"+_type)
        elem.append(input);
        elem.append('<span class="checkmark"></span>');
        elem.append(label);
        
        var fs = $('<fieldset></fieldset>').addClass("dropdown");
        for(var _name in gRecord.skeleton[_type]) {
          var div = $('<div></div>');
          var nlabel = $('<label></label>').attr('for','product-'+_name).text(simpleName(_name));
            // .addClass('unretrieved')
            // .addClass('product-name')
            // 
            // .data('product-name',_name)
            // .data('product-type',_type)
            // // .attr('title',nameToTitle(_name))
            // ;
          var ninput = $('<input type="radio"/>')
              .attr('id','product-'+_name)
              .attr('name','ctl-select-'+_type)
              .addClass('product-name')
              .addClass('unretrieved')
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
      }

      // Default menu order:
      var menus = ['wireimg','hits','tracks','showers','particles','spacepoints','endpoint2d','ophits','oppulses','opflashes'];
      for( t of menus) { 
        console.log(t,t in gRecord.skeleton);
        if( t in gRecord.skeleton ) add_type(t);
      }
      
      for( var t in gRecord.skeleton ) {
        console.log(t,menus.includes(t));
        if(!menus.includes(t)) add_type(t);
      }
      
    }
  } else {
    console.log("No Skeleton");
  }
  
  // Now look at the actual content. Look for new things by seeing if they've already been marked as retrieved.
  for(_type in gRecord) {
    var product_type_elem =  $("li.product-type").filter(function(){return $(this).data('product-type')==_type;});
    var product_type_input = $("input.product-type",product_type_elem);
    if(product_type_elem.length==0) continue;

    var n_new =0;
    var n_retrieved_before = $("input.product-name.retrieved",product_type_elem).length;
    
    for(_name in gRecord[_type]) {
      var item = $("input.product-name",product_type_elem).filter(function(){return $(this).data('product-name')==_name;});
      if(!item.hasClass('retrieved')) {
        n_new++;
        // This is a new piece.
        console.log("ControlOverlay: registered new item in the gRecord",_type,_name)
        item.removeClass('unretrieved').removeClass("pending").addClass('retrieved');
        // $('input',item).removeClass('unretrieved').removeClass("pending").addClass('retrieved');
        
        // Is it selected? if so, update everyone accordingly
      }
      
      // $('input[value="'+_name+'"]',product_type_elem).removeClass('unretrieved').addClass('retrieved');
    }
    
    var n_pending = $("input.product-name.pending",product_type_elem).length;
    console.warn("pending check",_type,n_pending);
    if(n_pending == 0) product_type_input.removeClass("pending");
    if(n_new>0) {
      // Turn on the product label.
      // product_type_label.removeClass('unretrieved').addClass('retrieved');
      // Pulse the label.
      product_type_input.removeClass('unretrieved');
      label = product_type_input.siblings("label")[0];
      label.classList.remove("pulse");
      void label.offsetWidth; // allows pulse retriggering see https://codepen.io/chriscoyier/pen/EyRroJ
      label.classList.add("pulse");
    }
    if(n_new>0 && n_retrieved_before==0) {
      // We don't have one type selected as a radio box. That ain't good... select one.
      $('input.retrieved',product_type_elem).first().click();
      gStateMachine.Trigger('change-'+_type);
    }
  }
  
  // Glow on/off for activated types.
}

ControlOverlay.prototype.Click = function(a,b,c)
{
  console.log("Click",a,b,c);
}

ControlOverlay.prototype.OnChangeProductType = function(ev)
{
  // Toggle this type of thing on/off
  var tgt = $(ev.currentTarget);
  var _type = tgt.data('product-type');
  console.log("OnChangeProductType",_type);
  gStateMachine.Trigger('toggle-'+_type);
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
    product_type_input.addClass("pending").prop("checked","checked");
    tgt.addClass("pending");
    RequestPiece('/'+_type+'/'+_name);    
  }
}


  