


// Modernizr.load({
//   test: Modernizr.canvas,
//   // yep : 'geo.js',
//   nope: 'libs/flashcanvas.js'
// });



if(! Modernizr.canvas ){
  window.location = "browser_warning.html";
}

