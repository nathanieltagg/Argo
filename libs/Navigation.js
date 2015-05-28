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
  this.hashchange_pending = true;
  var defaults = {};
  // override defaults with options.
  $.extend(true,defaults,options);
  ABoundObject.call(this, element, defaults); // Give settings to Pad contructor.

  this.tree_element = $(".tree",this.element);
  var cur_item = null;

  var self = this;
  gOmData.add("HLIST");
  $(document).on("OmDataRecieved", function(){return self.GetListing();});
  console.timeStamp("Starting query.");
  gOmData.get();
  
  $(window).hashchange( function(){self.HashChange();} );
  $(".reload",this.element).click( function(){
    gOmData.add("HLIST");
    gOmData.get();
    self.hashchange_pending = true;
  });
}

Navigation.prototype.GetListing = function()
{  
  console.time("Navigation::GetListing");
  // Pull a specific path out of the results.
  if(!gOmData.data) return;
  if(!gOmData.data.record) return;
  if(!gOmData.data.record.shipment) return;
  var regex = /HLIST(.*)/;
  for(p in gOmData.data.record.shipment) {
    var match = regex.exec(p);
    if(match) {
      var path = match[1]; 
      var layout = gOmData.data.record.shipment[p];
      // Remove from future retrieves.
      gOmData.remove(p);
      
      if(path == "" || path == "/") {
        console.log("GetListing, from root");
        gOmData.remove("HLIST");

        // $("a",layout).click(function(){self.ItemClicked(this);});
        // console.timeStamp("Done adding click callback.");
        console.time("Navigation::GetListing add html");
        $(this.tree_element).hide(); // temproary while we fill.
        $(this.tree_element).html(layout);

        // Reveal the root element. Be default .css, all are hidden.
        // $("li>ul",this.tree_element).hide();
        $(this.tree_element).children().show();
        $(this.tree_element).children().children().show();
        $(this.tree_element).show(); // Reveal
        console.timeEnd("Navigation::GetListing add html");
      } else {
        // path is something specfic not in the root.
        console.log("GetListing, in path",path);
        
        // Find the branch of the tree that we need to fill or re-fill
        // Requires exact match of the path, with trailing "/"
        // Requires that stump (data-unfinished) is there
        // Fails silently if no such path.
        // Probably fails if there are multiple HLIST elements, out of order.
        // console.log($('li[data-ompath="'+path+'"]', this.tree_element))
        // debugger;
        $('li[data-ompath="'+path+'"]>ul', this.tree_element).replaceWith(layout);
        var ul = $('li[data-ompath="'+path+'"]>ul', this.tree_element);
        ul.show();
        ul.children().show();
        // ul.children().children.show();
      }
    }
  }
  
  // Pull outstanding requests.
  if(this.hashchange_pending) {
    console.time("Navigation::GetListing pending hashchange");
    this.hashchange_pending = false;
    this.HashChange();
    console.timeEnd("Navigation::GetListing pending hashchange");
  }

  console.timeEnd("Navigation::GetListing");
  
};

Navigation.prototype.PullListingsFor = function(paths)
{
  console.log("Navigation::PullListingsFor",paths);
  
  // Call this function
  for(var i =0; i<paths.length; i++) {
    var target = paths[i];
    
    // OK, work backwards. Dig until you get an existing path.
    var done = false;
    while(!done) {
      target = target.substr(0,target.lastIndexOf("/"));  // target = /root/sub1/sub2
      if(target.length<=0) break;
      var targetslash = target+'/';
      var got = $('li[data-ompath="'+targetslash+'"]', this.tree_element);
      if(got.length) { gOmData.add('HLIST'+targetslash); done = true; }
    }
  }
  gOmData.get();
} 


Navigation.prototype.HashChange = function(item) 
{
  // Called either when user clicks on a link with a href=#histogrampath
  // or after a new listing has been pulled that might have things we want.
  console.log("HashChange",location.hash);
  var hash = location.hash;
  hash = hash.substr(1); // Strip hash # character.
  if(hash.length <1) return;
  var paths = hash.split(',');
  var unfound_paths = [];
  var items=[];
  for(var ipath = 0;ipath < paths.length; ipath++) {
    var path = paths[ipath];
    var item = $('a[href="#'+path+'"]', this.tree_element);
    if(item.length>0) items.push(item.get(0));
    else unfound_paths.push(path);
  }
  if(unfound_paths.length>0) {
    this.hashchange_pending = true;
    // Our listing is incomplete. We don't have everything we need!
    this.PullListingsFor(unfound_paths);
  } else {
    this.ItemsClicked(items);        
  }
};

Navigation.prototype.ItemsClicked = function(items)
{
  console.log("Navigation::ItemsClicked",items);
  var firstitem = items[0];
  $(".ui-state-highlight",this.tree_element).removeClass("ui-state-highlight");
  $(firstitem).parent().addClass("ui-state-highlight");
  
  // Reveal all elements above.
  console.log("ItemClicked() hiding all");
  $("li>ul",this.tree_element).hide();
  
  $(firstitem).parentsUntil(this.tree_element).show();//.children(".collapsible-icon").addClass('ui-icon-triangle-1-s'.removeClass('ui-icon-triangle-1-e');
  
  
  // Clear the main area.
  gViews = [];
  $("div.A-mainview").empty();
  
  var orders = [];
  
  for(var iItem=0;iItem<items.length;iItem++) {
    var curItem = items[iItem];

    // Do that mother. Is the selected thing an object?
    if($(curItem).hasClass("om-elem")) {
      orders.push(
        { path: $(curItem).data("ompath"),
          roottype: $(curItem).data("roottype")
        }
      );
    } else {
      // It's a directory. Pull all objects, but not sub-objects.    
      var next = $(curItem).next();
      console.log("ItemClicked/directory",$(next));
      gOmData.add("HLIST"+$(curItem).data("ompath"));
      $(next.show(200).children('li').show(200).children('a')).each(function(){
        if($(this).hasClass("om-elem")) {
          console.log("push item",$(this).data("ompath"));
          orders.push(
            { path: $(this).data("ompath"),
              roottype: $(this).data("roottype")
            }
          );
        };
      });
    }
    
  }
  
  
  // Add new directory info object to DOM
  
  
  // Add new histogram objects to the dom.
  for(var i=0;i<orders.length;i++) {
    var order = orders[i];
    console.log("Creating new object for ",order);

    // Do portlet.
    var portlet = $('<div class="portlet"></div>');
    $("div.A-mainview").append(portlet);
    // var portlet_header = $('<div class="portlet-header"><span class="portlet-title'>'"'+order.path+'<span></div>');
    // var portlet_content = $('<div class="portlet-content" id="'+order.path+'"></div>');
    $(portlet).append('<div class="portlet-header"></div>')
    $(portlet).append('<div class="portlet-content" id="'+order.path+'"></div>');
    $(".portlet-header",portlet).html('<a class="portlet-title" href="#'+order.path+'">'+order.path+'</a>');
    var portlet_content = $(".portlet-content",portlet);
    console.log("Creating portlet",portlet," with content",portlet_content);

    if(order.path.match(/DirectoryInfo/)){
      gViews.push(new OmDirInfoCanvas(portlet_content,order.path));
    
    } else if(order.path.match(/tpc\/mapccc/)) {
      gViews.push(new ChannelMap(portlet_content,order.path));

    } else if(order.path.match(/pmt\/mapccc/)) {
      gViews.push(new ChannelMapPmt(portlet_content,order.path));      

    } else if(order.path.match(/tpc\/mapwire/)) {
      gViews.push(new TpcMap(portlet_content,order.path));      

    } else if(order.path.match(/pmt\/mappmt/)) {
      gViews.push(new PmtMap(portlet_content,order.path));      

    } else if (order.roottype.match(/TH2/)){
      gViews.push(new OmHist2Canvas(portlet_content,order.path));

    } else {
      gViews.push(new OmHistCanvas(portlet_content,order.path));
    }
  }
  SetupPortlets($("div.A-mainview"));
  
  // Activate the elements.
  console.timeStamp("New displays ready, calling get for data");
  
  // Go get the data.
  gOmData.get();
  gRefData.get();
  
};
