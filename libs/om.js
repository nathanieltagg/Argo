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

var gOM = null;
$(function(){
  gOM = new OM();
});

function OM()
{
  this.recent_cycle = null;
  this.data = {};
}

OM.prototype.get = function()
{
  
}