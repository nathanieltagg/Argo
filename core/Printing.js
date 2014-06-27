//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

//
// Printing
//

gPrintBuffer = "";
gPrintScale = 5;

function DoPrint(objToPrint,execPrintOrder)
{     
      console.log("Printing",objToPrint);

      // Make a unique name.
      var strFrameName = "_" + $(objToPrint).attr("id");
      
      console.log("printing "+strFrameName);
      
      //
      // Print this div.
      //
      // Based of idea at http://www.bennadel.com/blog/1591-Ask-Ben-Print-Part-Of-A-Web-Page-With-jQuery.htm
      //
      

      // For now, let's use a new window, so we can look at it.
      var windowType = "window";
      var outDoc, newWin, objFrame, jFrame;
      
      if(windowType == "window") {
        newWin= window.open("");
        outDoc = newWin.document;
      }
      
      if(windowType=="frame") {
        // Create an iFrame with the new name.
        var uniqueName = strFrameName + (new Date().getTime());
        jFrame = $( "<iframe name='" + uniqueName +"'>" );
       
        // Hide the frame (sort of) and attach to the body.
        jFrame
          .css( "width", "1px" )
          .css( "height", "1px" )
          .css( "position", "absolute" )
          .css( "left", "-9999px" )
          .appendTo( $( "body:first" ) )
          ;
       
        // Get a FRAMES reference to the new frame.
        objFrame = window.frames[ uniqueName ];
       
        // Get a reference to the DOM in the new frame.
        outDoc = objFrame.document;
      }
      
      // Grab all the style tags and copy to the new
      // document so that we capture look and feel of
      // the current document.
       
      // Create a temp document DIV to hold the style tags.
      // This is the only way I could find to get the style
      // tags into IE.
      var jStyleDiv = $( "<div>" )      
                      .append(  $("link[rel='stylesheet']").clone() )
                      .append(  $("style").clone() );
                      
      var jPrintDiv = $( "<div id='printDiv'>" )
                      .append($(objToPrint).clone());


      // Write the HTML for the document. In this, we will
      // write out the HTML of the current element.
      outDoc.open();
      outDoc.write( "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">" );
      outDoc.write( "<html>" );
      outDoc.write( "<body>" );
      outDoc.write( "<head>" );
      outDoc.write( "<title>" );
      outDoc.write( strFrameName );
      outDoc.write( "</title>" );
      outDoc.write( jStyleDiv.html() );
      outDoc.write( "</head>" );
      outDoc.write( "<body>" );
      outDoc.write( jPrintDiv.html() );

      outDoc.write( "</body>" );
      outDoc.write( "</html>" );
      outDoc.close();
      // $(".portlet-content",outDoc).show(); // In case it's hidden.
      //$(".portlet",outDoc).height($(portlet).height());
      //$(".portlet",outDoc).width($(objToPrint).width());
      
      console.log("Printing objToPrint:",objToPrint," width:",$(objToPrint).width(),"to:",$('#printDiv',outDoc));
      
      $('body > div',outDoc).first().width($(objToPrint).width());
      // $('#'+$(objToPrint).attr('id'),outDoc).width($(objToPrint).width());

      // Following code works well, but doesn't handle non-Pad canvases.
      // Let pads print themselves.
      var srcPads = $(".pad",objToPrint);
      var img, dstCanvas;
      
      for(var i=0;i<srcPads.length;i++) {
        console.log("Requesting high-quality print from ",srcPads.get(i));
        $(srcPads.get(i)).trigger("PrintHQ");
        img = gPrintBuffer;
        dstCanvas = $(".pad canvas",outDoc).get(0);
        var scale = 100/gPrintScale;
        $(dstCanvas).replaceWith("<img width='100%' height='100%' src='"+img+"' />");
        //$(dstCanvas).replaceWith("<img width='"+scale+"%' height='"+scale+"%' src='"+img+"' />");
        gPrintBuffer="";
      }

      // Change remaining canvases into images. May not work.
      var srcCanvas = $("canvas",objToPrint).not(".pad canvas");
      for(i=0;i<srcCanvas.length;i++) {
        console.log("Looking at canvas",srcCanvas.get(i));
        img = srcCanvas.get(i).toDataURL("image/png");
        console.log("Created image");
        dstCanvas = $("canvas",outDoc).not(".pad canvas").get(0);
        console.log("Replacing canvas",dstCanvas);
        
        $(dstCanvas).replaceWith("<img src='"+img+"' />");
      }


      
      if(windowType == "window") {
        if(execPrintOrder) newWin.print();
      } 
      if(windowType == "frame") {
        objFrame.focus();
        objFrame.print();
        // Have the frame remove itself in about a minute so that
        // we don't build up too many of these frames.
        setTimeout( function(){jFrame.remove();},
                    (60 * 1000)
                  );
      }
} 

