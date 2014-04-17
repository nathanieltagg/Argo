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

gViews = [];

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
  this.first_load = true;
  var defaults = {};
  // override defaults with options.
  $.extend(true,defaults,options);
  ABoundObject.call(this, element, defaults); // Give settings to Pad contructor.

  this.tree_element = $(".tree",this.element);
  var cur_item = null;

  var self = this;
  gOmData.add("HLIST");
  $(document).on("OmDataRecieved", function(){return self.GetListing()});
  console.timeStamp("Starting query.");
  gOmData.get();
  
  $(window).hashchange( function(){self.HashChange()} );
  $(".reload",this.element).click( function(){
    gOmData.add("HLIST");
    gOmData.get();
    self.first_load = true;
  })
}

Navigation.prototype.GetListing = function()
{  
  var layout = gOmData.getObj('HLIST');
  if(!layout) return;
  console.timeStamp("GetListing.");
  gOmData.remove("HLIST");

  // var self = this;
  // $("a.om-dir-title",layout).addClass('ui-helper-clearfix').prepend('<span class="collapsible-icon ui-icon ui-icon-triangle-1-e" />')
  //                        .click(function(){
  //                          $(".collapsible-icon",this).toggleClass('ui-icon-triangle-1-e')
  //                                                     .toggleClass('ui-icon-triangle-1-s');
  //                          $(this).next().toggle(200);                       
  //                        })
  //                        .each(function(){ $(this).next().hide();})
  //                        ;//.next().toggle();
  // 
  //  console.timeStamp("Done adding collapsibles.");


  // $("a",layout).click(function(){self.ItemClicked(this);});
  // console.timeStamp("Done adding click callback.");
  $(this.tree_element).html(layout);
  // console.log("GetListing() hiding all");
  $("li>ul",this.tree_element).hide();
  
  
  // Highlight whichever one was in the url.
  if(this.first_load) {
    this.first_load = false;
    this.HashChange();
    // var item = $('a[href="'+window.location.hash+'"]', this.tree_element);
    // console.log(window.location.hash, 'a[href='+window.location.hash+']',item);
    // console.timeStamp("Calling ItemClicked with hashload.");    
    // if(item.length>0) this.ItemClicked(item.get(0));
  }
  
}

Navigation.prototype.HashChange = function(item) 
{
  console.log("HashChange",location.hash);
  var hash = location.hash;
  if(hash.length <1) return;
  var item = $('a[href="'+window.location.hash+'"]', this.tree_element);
  if(item.length>0) this.ItemClicked(item.get(0));
}

Navigation.prototype.ItemClicked = function(item)
{
  $(".ui-state-highlight",this.tree_element).removeClass("ui-state-highlight");
  $(item).parent().addClass("ui-state-highlight");
  
  // Reveal all elements above.
  console.log("ItemClicked() hiding all");
  $("li>ul",this.tree_element).hide();
  
  $(item).parentsUntil(this.tree_element).show();//.children(".collapsible-icon").addClass('ui-icon-triangle-1-s'.removeClass('ui-icon-triangle-1-e');
  
  // Do that mother. Is the selected thing an object?
  var items = [];
  if($(item).hasClass("om-elem")) {
    items.push(
      { path: $(item).data("ompath"),
        roottype: $(item).data("roottype")
      }
    );
  } else {
    // It's a directory. Pull all objects, but not sub-objects.    
    console.log("ItemClicked/directory",$($(item).next()));
    $($(item).next().show(200).children('li').show(200).children('a')).each(function(){
      if($(this).hasClass("om-elem")) {
        console.log("push item",$(this).data("ompath"));
        items.push(
          { path: $(this).data("ompath"),
            roottype: $(this).data("roottype")
          }
        );
      };
    });
  }

  console.log(items);
  
  // Clear the main area.
  gViews = [];
  $("div.A-mainview").empty();
  // Add new histogram objects to the dom.
  for(var i=0;i<items.length;i++) {
    var item = items[i];
    console.log("Creating new object for ",item);

    // Do portlet.
    var portlet = $('<div class="portlet"></div>');
    $("div.A-mainview").append(portlet);
    // var portlet_header = $('<div class="portlet-header"><span class="portlet-title'>'"'+item.path+'<span></div>');
    // var portlet_content = $('<div class="portlet-content" id="'+item.path+'"></div>');
    $(portlet).append('<div class="portlet-header"></div>')
    $(portlet).append('<div class="portlet-content" id="'+item.path+'"></div>');
    $(".portlet-header",portlet).html('<span class="portlet-title">'+item.path+'</span>');
    var portlet_content = $(".portlet-content",portlet);
    console.log("Creating portlet",portlet," with content",portlet_content);

    if(item.path.match(/tpc\/mapccc/)) {
      gViews.push(new ChannelMap(portlet_content,item.path));
    } else if (item.roottype.match(/TH2/)){
      gViews.push(new OmHist2Canvas(portlet_content,item.path));
    } else {
      gViews.push(new OmHistCanvas(portlet_content,item.path));
    }
  }
  SetupPortlets($("div.A-mainview"));
  
  // Activate the elements.
  console.timeStamp("New displays ready, calling get for data");
  
  // Go get the data.
  gOmData.get();
  gRefData.get();
  
}
