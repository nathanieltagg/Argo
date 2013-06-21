//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...


$(function(){
  $('div.A-navtree').each(function(){

    gNav = new Navigation(this);

  });  
});

// Subclass of ABoundObject.
Navigation.prototype = new ABoundObject(null);           

function Navigation(element, options)
{
  if(!element) return;
  var defaults = {};
  // override defaults with options.
  $.extend(true,defaults,options);
  ABoundObject.call(this, element, defaults); // Give settings to Pad contructor.

  var self = this;
  this.omdata = new OmDataObj("HLIST");
  this.omdata.callback_newdata = function(){return self.GetListing()};
  this.omdata.get();
}

Navigation.prototype.GetListing = function()
{
  var self = this;
  var layout = $(this.omdata.data.record.HLIST.data);
  $("a.om-dir-title",layout).addClass('ui-helper-clearfix').prepend('<span class="collapsible-icon ui-icon ui-icon-triangle-1-e" />')
                         .click(function(){
                           $(".collapsible-icon",this).toggleClass('ui-icon-triangle-1-e')
                                                      .toggleClass('ui-icon-triangle-1-s');
                           $(this).next().toggle(200);                       
                         })
                         .each(function(){ $(this).next().hide();})
                         ;//.next().toggle();
  $("a",layout).click(function(){self.ItemClicked(this);});
  $(this.element).html(layout);
  // Highlight whichever one was in the url.
  var item = $('a[href='+window.location.hash+']', this.element);
  console.log(window.location.hash, 'a[href='+window.location.hash+']',item);
  if(item.length>0) this.ItemClicked(item.get(0));
  
}

Navigation.prototype.ItemClicked = function(item)
{
  $(".ui-state-highlight",this.element).removeClass("ui-state-highlight");
  $(item).parent().addClass("ui-state-highlight");
  
  // Do that mother. Is the selected thing an object?
  var items = [];
  if($(item).hasClass("om-elem")) {
    items.push(
      { path: $(item).data("ompath"),
        roottype: $(item).data("roottype")
      }
    );
  } else {
    // It's a directory. Pull all objects.
    console.log($(item).next());
    console.log($('li',$(item).next()));
    
    $('li',$(item).next()).each(function(){
      items.push(
        { path: $(this).data("ompath"),
          roottype: $(this).data("roottype")
        });
    })
  }

  console.log(items);
}
