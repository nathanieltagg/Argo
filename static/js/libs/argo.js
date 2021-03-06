//
// Code for the ARgo Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

///
/// Boilerplate:  Javascript utilities for MINERvA event display, codenamed "Argo"
/// Nathaniel Tagg  - NTagg@otterbein.edu - June 2009
///


//
// 'Main' scripts for argo.html
// Used to be in 'head', but it was too unwieldly.
//

// Global error handler: tell the user something good to do about it.
window.onerror = function(arg1,arg2,arg3) {
  var subject = "Script error to report";
  var body = "Script error: "+ escape(arg1)
            +"\nfile: "+ escape(arg2)
            +"\nline: " + escape(arg3)
            +escape("\nFrom event:")+escape(gUrlToThisEvent)
            +escape("\n Url: "+window.location);
  var email = "<a href='mailto:ntagg@otterbein.edu?subject=" + subject + "&body="+body+"'>Send Bug Report</a>";
  $('#status').attr('class', 'status-error').html(
    "Script Error!<br/>"+arg1+" "+arg2+" line"+arg3 + "</br>" + email
  );  
}

gPhColorScaler = new ColorScaler();
gPhColorScaler.max=10;

// Global cuts
gPhCut   = { min: null, max: null };
gShowFlaggedHitsOnly = false;




//
// Function to look up 'GET' parameters from an encoded URL.
function GetUrlParameter( name )
{
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return null;
  else
    return results[1];
}






///
/// Code that sets up collapsibles.
///
function make_collapsibles(elem)
{
  $(".collapsible-title",elem).addClass('ui-helper-clearfix').prepend('<span class="collapsible-icon ui-icon ui-icon-triangle-1-s" />')
                         .click(function(){
                           $(".collapsible-icon",this).toggleClass('ui-icon-triangle-1-e')
                                                      .toggleClass('ui-icon-triangle-1-s');
                           $(this).next().toggle();                       
                         })
                         .filter("[data-revealed=false]")
                         .click();
}
  
$(function(){
  make_collapsibles($('body'));
});


$(function(){
  $(".BuildTabs").tabs();
});

///
/// Code that sets up portlets.
///

// portlet resizing:
// This is defunct if you use flexbox.
function resizePortlet(portlet,oldheight,newheight)
{
  console.log("resizePortlet",portlet,oldheight,newheight);
  // var portlet = ui.element[0];
  // Look for things in the portlet that are squeezable. Mostly this is pads right now, but include the option
  var squeezables = $(".squeezable,.pad",portlet).filter(function(){
    // Filter out objects being floated.
    var parents = $(this).parents();
    for(var ip=0;ip<parents.length;ip++) {
      if(parents[ip]==portlet) return true;
      if($(parents[ip]).hasClass("nonsqueezeable")) return false;
      var float = $(parents[ip]).css("float");
      if(float && float == "right") return false;
    }
  });

  if(squeezables.length==0) return;
  console.log("Squeezables:",squeezables);
  var h1 = oldheight;
  var h2 = newheight;
  var pixels_needed = h2-h1;
  var squeezable_heights = [];
  squeezables.each(function(){
    squeezable_heights.push($(this).height());
  });
  var total_squeezable_height =0;
  for(var i=0;i<squeezable_heights.length;i++) total_squeezable_height+=squeezable_heights[i];
  var new_total = total_squeezable_height + pixels_needed;
  if(new_total<=0) return;
  var ratio = new_total/total_squeezable_height;
  console.log("h1",h1,"h2",h2,"total_squeezable",total_squeezable_height,"newtotal",new_total,"ratio",ratio);
  // Apply to all pads, not just the primaries.
  $(squeezables).each(function(){
    var h = $(this).height(); $(this).height(h*ratio);
  });

  console.log("resize",portlet);
  $(portlet).trigger("resize")
}

$(function(){
  
  // style portlets and add icons.
  // var headers = $(".portlet").addClass("ui-widget ui-widget-content ui-corner-all")
  //               .find(".portlet-header");
  // headers.addClass("ui-widget-header ui-corner-all");
  
  // fullscreen
  // headers.prepend('<span class="ui-icon ui-icon-arrow-4-diag icon-explode"></span>');
  var headers = $("div.portlet .portlet-header");
  $('.portlet-header .icon-explode').click(function() {      
      var portlet = $(this).parents(".portlet:first")[0];
      console.log("Explode",portlet);  
      var oldheight = $(portlet).height();
      console.log("oldheight",oldheight);
      $(portlet).data('unexploded-height',oldheight);
      var oldheights = [];
      var pads = $("div.pad",portlet);
      for(var i =0 ;i<pads.length;i++) oldheights[i] = $(pads[i]).height();
      
      gEnbiggening = true;
      console.log("exploding",portlet);
      $(portlet).addClass('full-screen');
      if (portlet.requestFullscreen) {
        console.log("requestFullscreen");
        portlet.requestFullscreen();
      } else if (portlet.mozRequestFullScreen) {
        console.log("mozRequestFullscreen");
        portlet.mozRequestFullScreen();
      } else if (portlet.webkitRequestFullScreen) {
        console.log("webkitRequestFullscreen");
        // portlet.webkitRequestFullScreen();
        portlet.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
       }      
  });
  
  $("div.portlet").on("webkitfullscreenchange mozfullscreenchange fullscreenchange",function(event) {
    console.log("doing fullscreen callback",event,gEnbiggening,this);
    if(gEnbiggening) {
      var h = $(this).height();
      $(this).data('exploded-height',h);
      console.log('enbiggening from ',$(this).data('unexploded-height'),"to",h);
      resizePortlet(this,$(this).data('unexploded-height'),h);
      gEnbiggening = false;
    } else {
      $(this).removeClass('full-screen');

      console.log('deenbiggening from ',$(this).data('exploded-height'),"to",$(this).data('unexploded-height'));
      resizePortlet(this,$(this).data('exploded-height'),$(this).data('unexploded-height'));
    }
  });
  

  // print icon
  if(!isIOS()) {
    headers.each(function(){
      if($('#'+$(this).parents(".portlet:first").attr("id")+"-help-text").length>0)
        $(this).prepend('<span class="ui-icon ui-icon-help"></span>')                             
    });
    // headers.prepend('<span class="ui-icon ui-icon-print"></span>'); 
  }

  // Download icon
  // headers.prepend('<span class="ui-icon ui-icon-circle-arrow-s download_img"></span>');
  
  
  // Expand/collapse icon
  headers.each(function(){
    if($(this).parents(".portlet:first").find(".portlet-content").is(":hidden")) {
      $('.icon-shrink',this).removeClass("ui-icon-minusthick").addClass("ui-icon-plusthick");
    }
    
  });

  headers.each(function(){
    if($(this).parents(".portlet:first").find(".portlet-content").is(":hidden")) {
      $('.icon-shrink',this).removeClass("ui-icon-minusthick").addClass("ui-icon-plusthick");
    }
    
  });

  $(".portlet-header .ui-icon-print").click(function(){    
                                                      var portlet = $(this).parents(".portlet:first");
                                                      var content = $('.portlet-content',portlet);
                                                      return DoPrint(content,false,true);
                                                    } );

                                     
  // Printable.  
  $('#Print').click(function(){return DoPrint($('#everything'),true);});


  // Download as img
  
  $(".portlet-header .download_img").click(function(){    
            var portlet = $(this).parents(".portlet:first")[0];
            
            DownloadImage(portlet);
        }
       );


  $(".portlet").mouseover(function(event){
        // console.log("mouseover",this);
        gPortletHover = this;
  });
  
  // Explodeable.
  // $(".portlet-header .icon-explode").click(function(){
 //    
 //    var portlet = $(this).parents(".portlet:first");
 //    var content = portlet.find(".portlet-content");
 // 
 //    $(portlet).toggleClass("portlet-fullscreen");
 //    content
 //      .trigger("resize")
 //      .find(".pad").trigger("resize");
 //  });


  // Expandable and contractable.
  $(".portlet-header .icon-shrink").click(function() {
          $(this).toggleClass("ui-icon-minusthick");
          $(this).toggleClass("ui-icon-plusthick");
          $(this).parents(".portlet:first").find(".portlet-content")
            .toggle()
            .trigger("resize")
            .find(".pad").trigger("resize");
  });
  $(".portlet-header").dblclick(function() { $(".icon-shrink",this).trigger("click"); return false; });


  // Help function:
  $(".portlet-header .ui-icon-help").click(function() {
    $('#'+$(this).parents(".portlet:first").attr("id")+"-help-text")
      .dialog({
            modal: true,
            buttons: {
              Ok: function() {
                $(this).dialog('close');
              }
            }
          }).dialog('open');
  });
  
  // Make portlets resizable.
  // The problems with this:
  // - Does not constrain horizontal
  // - Does not scale inner objects.
  $(".portlet").resizable({
    // containment: 'parent',
    handles: "s,se",
    // Allow only vertical resizing:
    start: function(event,ui) { $(ui.element).resizable("option","minWidth",ui.originalSize.width).resizable("option","maxWidth",ui.originalSize.width); },
    stop:  function(event,ui) { resizePortlet(ui.element[0], ui.originalSize.height, ui.size.height); }
  });

  // Issue custom commands to resize inner content.
  // $(".dock").bind('sortstop', function(event, ui) {
  //   $('.pad',ui.item).trigger("resize");
  // });


  // Make portlets sortable.
  $(".dock").sortable({
                connectWith: '.dock',
                handle: '.portlet-header'
        });
        
  // Make portlets blow-up-able
  // Disabled above. I didn't like the effect.
  $(".portlet-header .icon-expand").click(function() {
    var portlet = $(this).parents(".portlet:first");
    if(!portlet.hasClass("portlet-fullscreen")) {
      // expand.
      $("<div id='expando-placeholder'></div>").insertAfter($(portlet));
      $('#expando-target').prepend($(portlet));
      
      $('#expando-target').addClass("portlet-fullscreen");
      portlet.addClass("portlet-fullscreen");
      portlet.resize();
      
    } else {
      // contract
      portlet.removeClass("portlet-fullscreen");
      portlet.insertAfter($('#expando-placeholder'));
      portlet.resize();
      $('#expando-placeholder').remove();
    }
  });

  // Issue custom commands to resize inner content.
  $(".dock").bind('sortstop', function(event, ui) {
    $('.pad',ui.item).trigger("resize");
  });
  
});


//
// Dialogs:
//
// $.ui.dialog.defaults.bgiframe = true;
$(function() {
  // Generic configuration dialogs
  $(".dialog").dialog({autoOpen:false,position:'left'});

  // Dialog-activating buttons.
  $(".open-dialog").addClass("ui-state-default ui-corner-all")
                   .click(function(ev){
                     // Cleverness: #open-time-dialog opens the dialog named #time-dialog
                     $('#'+this.id.replace(/^open-/,"")).dialog('open').dialog('moveToTop').effect('highlight');
                   });
});



////////////////////////////////////////
// Save control
////////////////////////////////////////
function SaveAControl(el,slot) 
{

  var input = $(el);
  var val = input.val();
  var id = el.id
  if(input.is(":radio")) {
    id = input.attr('name');
    val = el.id;
  } 
  if(input.is(":checkbox")) val = input.is(":checked");
  Cookies.set(slot+"--"+id,val);
  console.log("Saved control",id,val);
}
  

////////////////////////////////////////
// Auto-Save
////////////////////////////////////////
$(function(){
  $('body').on("click change",'input.saveable.auto-save-on-change',function(ev) {
    SaveAControl(this,'save');
  });
})
  

////////////////////////////////////////
// Save
////////////////////////////////////////
function SaveSettings( slot ) {
  // Cookie expiration date.
  expdate = new Date();
  expdate.setFullYear(2020);
  
  var hidden_list = [];
  var unhidden_list = [];
  $(".portlet").each(function(){
    if($(".portlet-content",this).is(":hidden"))   hidden_list.push(this.id);
    else                                         unhidden_list.push(this.id);
  });

  Cookies.set(slot+"--hidden-portlets",     hidden_list.join(","),{expires: expdate});
  Cookies.set(slot+"--unhidden-portlets", unhidden_list.join(","),{expires: expdate});
  // console.log("saving ","hidden-portlets",hidden_list.join(","));
  // console.log("saving ","unhidden-portlets",unhidden_list.join(","));
  
  // Save portlet positions.
  $(".dock").each(function(){
    Cookies.set(slot+"--dock--"+this.id,
              $(this).sortable("toArray")
              ,{expires: expdate});
    // console.log("saving ","dock:"+this.id,$(this).sortable("toArray"));
    
  });
  
  // Save misc. configuration boxes.
  $(".saveable").each(function(){
    SaveAControl(this,slot);
  });

  // console.log("cookies saved.");
  myGrowl("Window Configuration Saved");
}



////////////////////////////////////////
// Restore
////////////////////////////////////////
function RestoreControlSettings( slot, elements, suppress_change_event ) {
  // console.log("RestoreControlSettings",slot,elements);
  $(".saveable",elements).each(function(){
    var changed = false;
    if($(this).is(':radio')){
      val = Cookies.get(slot+'--'+$(this).attr('name'));
      if(val == this.id)
        if(!$(this).is(":checked")) { 
          $(this).prop("checked",true); changed = true;
          console.log("Restored control",$(this).attr('name'),val);
          
        }
    } else {
      var val = Cookies.get(slot+"--"+this.id);    
      if(val!=null){
        // console.log("restoring:",this.id,val);
        if($(this).is(':checkbox')){

          if( (val=='true') != $(this).is(':checked')) changed = true;
          $(this).attr('checked',val=='true');

        } else if($(this).is('select')) {
          // console.log("changing selectbox to ",val);
          if($("option[value='"+val+"']",this).length!=0) {
            // Change it only if the option exists.
            if( val != $(this).val() ) changed = true;
            $(this).val(val);          
          }
        } else {
          if( val != $(this).val() ) changed = true;
          $(this).val(val);
        }       
      }
    }
    
    if(changed && !suppress_change_event) $(this).trigger('change'); // Just in case
  });
}

function RestoreSettings( slot, context, suppress_change_event ) {
  // console.log("RestoreSettings, slot=",slot);
  if(!context) context = $('body');
  // see ideas at http://www.shopdev.co.uk/blog/sortable-lists-using-jquery-ui/
  var hidden_list_str   = Cookies.get(slot+"--hidden-portlets");
  var unhidden_list_str = Cookies.get(slot+"--unhidden-portlets");
  if(!hidden_list_str  ) hidden_list_str = "";
  if(!unhidden_list_str) unhidden_list_str = "";
  var hidden_list = hidden_list_str.split(',');
  var unhidden_list = unhidden_list_str.split(',');
  
  $(".portlet",context).each(function(){
    var should_be_hidden = false;
    var this_portlet_is_configured = false;
    if($(this).hasClass('hidden-by-default')) {should_be_hidden=true; this_portlet_is_configured=true;}
    if(jQuery.inArray(this.id,  hidden_list)>=0) {should_be_hidden=true; this_portlet_is_configured=true;}
    if(jQuery.inArray(this.id,unhidden_list)>=0) {should_be_hidden=false; this_portlet_is_configured=true;}

    if(this_portlet_is_configured==false) return;

    var ishidden = $(".portlet-content",this).is(":hidden");
    // console.log(this,"ishidden:"+ishidden,"should be hidden:"+should_be_hidden);
    if(ishidden != should_be_hidden) {
         // hide or expose it
         console.warn("Toggling!",$('.portlet-header',this).text());
         $(".portlet-header .icon-shrink",this).toggleClass("ui-icon-minusthick")
                                           .toggleClass("ui-icon-plusthick");
         $(".portlet-content",this)
           .toggle()
           .trigger("resize");
     }
   });

   // console.log("RestoreSettings, slot=",slot);
   // The hard part: rebuilding the docks.
   $(".dock",context).each(function(){
     var cval = Cookies.get(slot+"--dock--"+this.id);
     // console.log("evaluating cookie","dock:"+this.id,cval);
     if(!cval ) return;
     var list = cval.split(',');
     for(var i=list.length-1;i>=0;i--){
       if(list[i]=="") continue;
       // Move through the list backwards. For each item, remove it from it's current location and insert at the top of the list.
       $(this).prepend($('#'+list[i]));
       // Fire the element's dom-change callback
       $('#'+list[i]+" .pad").trigger("resize");
     }
   });
   
   RestoreControlSettings(slot,context);
}

///
/// Code that sets up configuration callbacks.
///

$(function(){
  //
  // Cookies!
  //
  // Look at each portlet: this is a debugging check at page-load.
  $(".portlet").each(function(){
     var myid = this.id;
     if(myid=="" || myid==null || myid==undefined) 
       console.warn("Did not define an ID for one of the porlets:",$(".portlet-header",this).text());
  });
  
  $('#ctl-save-config').button().click(function() {
    SaveSettings("save");
  });

  $('#ctl-load-config').button().click(function(){
    RestoreSettings("save");
    myGrowl("Configuration Loaded");

    return true;
  });

  
  // Clear all cookies.
  $("#ctl-restore-defaults").button();
  $(".ctl-restore-defaults,#ctl-restore-defaults").click(function(){
    var cookies = Cookies.get();
    for (key in cookies) {
      console.log("removing "+ key);
      Cookies.remove(key);
    }
    location.reload();
    // myGrowl('Configuration restored to default.','(Reload to move windows to original positions')

    // if(gUrlToThisEvent) window.location = gUrlToThisEvent;
    // else window.location.reload();
  });
  

  
  // By default, load the saved cookie.
  RestoreSettings("save");


  // Scripts are ready for work!
  //
  $('#status').attr('class', 'status-ok');  
  $("#status").text("Ready.");


  var par = $.deparam.fragment(true);
  if(par.reload) { delete par.reload; window.location.hash = '#' + $.param(par); }
  if(!(par.what)&&!(par.filename)) { 
    if(gPageName.includes('live')) {
      par.what = "live"; location.replace('#' + $.param(par));
    } else {
      // default event.
      par.what = "json"; location.replace('#' + $.param(par));
    }
   } 

  // Initialize hashchange function.
  $(window).hashchange( HashChanged );
    
  // Do intial trigger on page load.
  console.log("Doing initial hashchange trigger");  
  
  HashChanged();

});


// Modal dialogs  https://www.w3schools.com/howto/tryit.asp?filename=tryhow_css_modal
$(function(){
  // When the user clicks on <span> (x), close the modal
  // Requires modal and contents to exist in DOM before this is called! No JS-build objects.
  $('.modal-closer').on("click",function() {
    $(this).parents(".modal").first().toggle();
  });

  // $('body').on('click','.modal-content',function(ev){
  //   return false;
  // })

  // When the user clicks anywhere outside of the model-content (i.e. on the background object), close all modals
  $('body').on('click','div.modal',function(ev) {
    if($(ev.target).is("div.modal")) $('div.modal').hide();
  });
})


// Tooltips.
// see https://jqueryui.com/tooltip/
$(function() {
  $( document ).tooltip();
});


// Publication settings
// One-push-o button to set for publication.
//
$(function(){
  $(".publication-settings").button().click( function() {
    // Set some things:
    $('#ctl-show-watermark').prop('checked',true);
    $('#ctl-show-labels').prop('checked',true);
    $('#ctl-show-tick-labels').prop('checked',false);
    
  })
})

$(function(){
  // Polyfill for range slider, allowing styling. see https://rangeslider.js.org/
  $('input[type="range"]').rangeslider();

})




// Time trial: what if instead of
// hit = { q: 1, plane: 0, ... }
// I instead did
// hit = [1,0,...] 
// 
// Results: 4200 Hits
// Size reduction is a factor of 3 (300 kB -> 100 kB) (((WAS THIS BEFORE OR AFTER HTTP COMPRESSION???)))
// Time to parse regular hits is ~6ms
// Time to parse array and turn it into regular hits is 6ms + 8ms = 14 ms. 
// So, not crazy, IF the data volume reduction is sufficient to increase speed.

var gHitArrayHeader = [];
var gHitArray = [];

function convertHitsToArray()
{
  console.time("convertHitsToArray");
  
  var hits = gRecord.hits["recob::Hits_ffthit__Reco"];

  gHitArray = [];
  gHitArrayHeader = ["clusid_dbcluster","plane","q","t","t1","t2","wire"];

  for(var i=0;i<hits.length;i++) {
    var hit = hits[i];
    var newhit = [];
    for(var j=0;j<gHitArrayHeader.length;j++) {
      newhit.push(hit[gHitArrayHeader[j]]);
    }
    gHitArray.push(newhit);
  }
  
  
  console.timeEnd("convertHitsToArray");
  var string_of_hits = JSON.stringify(hits);
  var string_of_array = JSON.stringify(gHitArray);
  console.log("Length before Array-izing:",string_of_hits.length);
  console.log("Length after  Array-izing:",string_of_array.length);
  
  console.time("parse_hits");
  var hits = JSON.parse(string_of_hits);
  console.timeEnd("parse_hits");

  console.time("parse_array");
  var array = JSON.parse(string_of_array);
  console.timeEnd("parse_array");
 
  
}

var gRebuildHits =[];
function convertArrayToHits()
{
  console.time("convertArrayToHits()");
  
  var gRebuildHits = [];
  for(var i=0;i<gHitArray.length;i++) {
    var row = gHitArray[i];
    var hit = {};
    for(var j=0;j<gHitArrayHeader.length;j++) {
      hit[gHitArrayHeader[j]] = row[j];
    }
    gRebuildHits.push(hit)
  }
  
  console.timeEnd("convertArrayToHits()");
  console.log(gRebuildHits);
}
