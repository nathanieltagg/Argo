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

        var label = $('<label><label>').addClass('unretrieved').addClass('product-type').text(_type).data('product-type',_type);
        var input = $('<input type="checkbox" />')
              .addClass('product-type')
              .addClass('saveable auto-save')
              .addClass('show-'+_type)
              .data('product-type',_type)
              .attr("id","ctl-show-"+_type)
        label.append(input).append('<span class="checkmark"></span>');
        elem.append(label);
        
        var fs = $('<fieldset></fieldset>').addClass("dropdown");
        for(var _name in gRecord.skeleton[_type]) {
          var nlabel = $('<label></label>')
            .addClass('unretrieved')
            .addClass('product-name')
            .text(simpleName(_name))
            .data('product-name',_name)
            .data('product-type',_type)
            // .attr('title',nameToTitle(_name))
            ;
          var ninput = $('<input type="radio"/>')
              .attr('name','ctl-select-'+_type)
              .addClass('product-name')
              .addClass('unretrieved')
              .attr('value',_name)
              .data('product-name',_name)
              .data('product-type',_type);
          nlabel.append(ninput).append('<span class="checkmark"></span>');
          
          fs.append(nlabel);
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
  for(_type in gRecord) {
    var product_type_elem =  $("li.product-type").filter(function(){return $(this).data('product-type')==_type;});
    if(product_type_elem.length==0) continue;
    var product_type_label = $("label.product-type",product_type_elem);
    product_type_label.removeClass('unretrieved').addClass('retrieved');
    // $("input.product_type",product_type_elem).prop("checked","checked"); // FIXME: ONLY IF WE ARE SHOWING THIS ELEMENT
    var n_new =0;
    
    for(_name in gRecord[_type]) {
      var item = $("label",product_type_elem).filter(function(){return $(this).data('product-name')==_name;});
      if(!item.hasClass('retrieved')) {
        n_new++;
        // This is a new piece.
        console.log("ControlOverlay: registered new item in the gRecord",_type,_name)
        item.removeClass('unretrieved').addClass('retrieved');
        $('input',item).removeClass('unretrieved').addClass('retrieved');
        product_type_label[0].classList.remove("pulse");
        void product_type_label[0].offsetWidth; // allows pulse retriggering see https://codepen.io/chriscoyier/pen/EyRroJ
        product_type_label[0].classList.add("pulse");
        
        // Is it selected? if so, update everyone accordingly
      }
      
      // $('input[value="'+_name+'"]',product_type_elem).removeClass('unretrieved').addClass('retrieved');
    }
    if(n_new>0) gStateMachine.Trigger('change-'+_type);
    
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
  gStateMachine.Trigger('toggle-'+_type);
  console.log("OnChangeProductType",_type);
}

ControlOverlay.prototype.OnChangeProductName = function(ev)
{
  var tgt = $(ev.currentTarget);
  var _type = tgt.data('product-type');
  var _name = tgt.data('product-name');
  var product_type_input =  $("input.product-type").filter(function(){return $(this).data('product-type')==_type;}).prop("checked","checked");
  // do we have it?
  var thing = ((gRecord || {})[_type] || {})[_name];
  if(thing) // it exists
    gStateMachine.Trigger('change-'+_type);
  else
    RequestPiece('/'+_type+'/'+_name);
}


  