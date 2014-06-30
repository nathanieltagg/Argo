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
  if( results === null )
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
$(function(){
  
  // style portlets and add icons.
  var headers = $(".portlet").addClass("ui-widget ui-widget-content ui-helper-clearfix ui-corner-all")
                .find(".portlet-header");
  headers.addClass("ui-widget-header ui-corner-all");
  
  // fullscreen
  headers.prepend('<span class="ui-icon ui-icon-arrow-4-diag icon-explode"></span>');
  $('.portlet-header .icon-explode').click(function() {
      var element = $(this).parents(".portlet:first")[0];  
      var oldheight = $(element).height();
      var oldheights = [];
      var pads = $("div.pad",element);
      for(var i =0 ;i<pads.length;i++) oldheights[i] = $(pads[i]).height();
      
      console.log("exploding",element);
      if (element.requestFullscreen) {
        console.log("requestFullscreen");
        element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        console.log("mozRequestFullscreen");
        element.mozRequestFullScreen();
      } else if (element.webkitRequestFullScreen) {
        console.log("webkitRequestFullscreen");
        element.webkitRequestFullScreen();
           /*
               *Kept here for reference: keyboard support in full screen
               * marioVideo.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
           */
       }
       $(element).addClass("full-screen");
      //  var newheight =window.innerHeight;
      //  for(var i =0 ;i<pads.length;i++) {
      //    var h = oldheights[i] * newheight / oldheight;
      //    console.log("Exploding.",oldheight,newheight,oldheights[i],h);
      //    $(pads[i]).height(h*2);
      //    $(pads[i]).trigger('resize');
      //  }
       $(window).trigger('resize');      
      
  });

  // print icon
  if(!isIOS()) {
    headers.each(function(){
      if($('#'+$(this).parents(".portlet:first").attr("id")+"-help-text").length>0)
        $(this).prepend('<span class="ui-icon ui-icon-help"></span>')                             
    });
    headers.prepend('<span class="ui-icon ui-icon-print"></span>');                       
  }
  
  // Expand/collapse icon
  headers.each(function(){
    if($(this).parents(".portlet:first").find(".portlet-content").is(":hidden")) {
      // console.log($(this).text(),"is hidden");
      $(this).prepend('<span class="ui-icon ui-icon-plusthick icon-shrink"></span>');
    } else {
      // console.log($(this).text(),"is not hidden");
      $(this).prepend('<span class="ui-icon ui-icon-minusthick icon-shrink"></span>');      
    }
  });

  $(".portlet-header .ui-icon-print").click(function(){    
                                                      var portlet = $(this).parents(".portlet:first");
                                                      var content = $('.portlet-content',portlet);
                                                      return DoPrint(content);
                                                    } );

                                     
  // Printable.  
  $('#Print').click(function(){return DoPrint($('#everything'),true);});

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
  // $(".portlet-content").resizable({
  //   containment: 'parent' 
  //  
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
     if(myid==="" || myid===null || myid===undefined) 
       console.warn("Did not define an ID for one of the porlets:",$(".portlet-header",this).text());
  });
  
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

    $.cookie(slot+":hidden-portlets",     hidden_list.join(","),{expires: expdate});
    $.cookie(slot+":unhidden-portlets", unhidden_list.join(","),{expires: expdate});
    // console.log("saving ","hidden-portlets",hidden_list.join(","));
    // console.log("saving ","unhidden-portlets",unhidden_list.join(","));
    
    // Save portlet positions.
    $(".dock").each(function(){
      $.cookie(slot+":dock:"+this.id,
                $(this).sortable("toArray")
                ,{expires: expdate});
      // console.log("saving ","dock:"+this.id,$(this).sortable("toArray"));
      
    });
    
    // Save misc. configuration boxes.
    $(".saveable").each(function(){
      val = $(this).val();
      if($(this).is(":checkbox")) val = $(this).is(":checked");
      $.cookie(slot+":"+this.id,val);
      // console.log("saving ",this.id,val);
    });

    console.log("cookies saved.");
    $.blockUI({ 
        message: '<h1>Configuration Saved.</h1>'
    }); 

    setTimeout($.unblockUI, 800); 
  }

  $('#ctl-save-config').button().click(function() {
    SaveSettings("save");
  });

  ////////////////////////////////////////
  // Restore
  ////////////////////////////////////////
  function RestoreSettings( slot ) {
    console.log("RestoreSettings, slot=",slot);
    // see ideas at http://www.shopdev.co.uk/blog/sortable-lists-using-jquery-ui/
    var hidden_list_str   = $.cookie(slot+":hidden-portlets");
    var unhidden_list_str = $.cookie(slot+":unhidden-portlets");
    if(!hidden_list_str  ) hidden_list_str = "";
    if(!unhidden_list_str) unhidden_list_str = "";
    var hidden_list = hidden_list_str.split(',');
    var unhidden_list = unhidden_list_str.split(',');
    
    $(".portlet").each(function(){
      var should_be_hidden = false;
      var this_portlet_is_configured = false;
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
     $(".dock").each(function(){
       var cval = $.cookie(slot+":dock:"+this.id);
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

     // Reset controls in list 
     // console.log("***RESTORING CONTROLS****");
      $(".saveable").each(function(){
        var val = $.cookie(slot+":"+this.id);
        if(val!=null){
          // console.log("restoring:",this.id,val);
          var changed = false;
          if($(this).is(':checkbox')){

            if( (val=='true') != $(this).is(':checked')) changed = true;
            $(this).attr('checked',val=='true');

          } else {
            if( val != $(this).val() ) changed = true;
            $(this).val(val);
          } 

          if(changed) $(this).trigger('change'); // Just in case
         }
      });
  }

  $('#ctl-load-config').button().click(function(){
    RestoreSettings("save");
    $.blockUI({ 
        message: '<h1>Configuration Loaded.</h1>'
    }); 

    setTimeout($.unblockUI, 800); 

    return true;
  });

  
  // Clear all cookies.
  $("#ctl-restore-defaults").button().click(function(){
    var Cookies = $.cookie();
    for (key in Cookies) {
      console.log("removing "+ key);
      $.removeCookie(key);
    }
    
    $.blockUI({ 
        message: '<h1>Configuration restored to default.</h1><p>Hit reload to move things back</p>'
    }); 

    setTimeout($.unblockUI, 800); 


    // if(gUrlToThisEvent) window.location = gUrlToThisEvent;
    // else window.location.reload();
  });
  

  
  // By default, load the saved cookie.
  RestoreSettings("save");

});


// Time trial: what if instead of
// hit = { q: 1, plane: 0, ... }
// I instead did
// hit = [1,0,...] 
// 
// Results: 4200 Hits
// Size reduction is a factor of 3 (300 kB -> 100 kB)
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
