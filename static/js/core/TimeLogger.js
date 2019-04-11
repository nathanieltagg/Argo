// // Subclass of ABoundObject.
// TimeLogger.prototype = new ABoundObject(null);
//
// gTimeLogger = null;
// $(function(){
//   $('div.A-TimeLogger').each(function(){
//     gTimeLogger = new TimeLogger(this);
//     window.console.time = gTimeLogger.TimeStart.bind(gTimeLogger);
//     window.console.timeEnd = gTimeLogger.TimeEnd.bind(gTimeLogger);
//   });
// });
//
// window.performance = window.performance || {};
// performance.now = (function() {
//     return performance.now       ||
//         performance.mozNow    ||
//         performance.msNow     ||
//         performance.oNow      ||
//         performance.webkitNow ||
//         Date.now  /*none found - fallback to browser default */
// })();
//
//
// function TimeLogger( element, options )
// {
//   if(!element) return;
//   var defaults = {
//   };
//   // override defaults with options.
//   $.extend(true,defaults,options);
//   ABoundObject.call(this, element, defaults); // Give settings to ABoundObject contructor.
//
//   this.data={};
//   this.active={};
//
// }
//
// TimeLogger.prototype.TimeStart = function(id)
// {
//   this.active[id]=performance.now();
// }
//
// TimeLogger.prototype.TimeEnd = function(id)
// {
//   var end = performance.now();
//   var dt = end - this.active[id];
//
//   this.data[id] = this.data[id] || {min:1e99, max:-1e99, tot:0, n:0};
//   var el = this.data[id];
//   el.n++;
//   el.tot += dt;
//   if(dt< el.min) el.min = dt;
//   if(dt>el.max) el.max = dt;
//
//   this.Draw();
// }
//
// TimeLogger.prototype.Draw = function()
// {
//   var h = "<table class='TimeLogger'>";
//   for(id in this.data) {
//     var el = this.data[id];
//     h += "<tr>";
//     h += "<td>" + id + "</td>";
//     h += "<td>min:" + el.min.toFixed(0) + " ms</td>";
//     h += "<td>mean:" + (el.tot/el.n).toFixed(0) + " ms</td>";
//     h += "<td>max:" + el.max.toFixed(0) + " ms</td>";
//     h += "</tr>";
//   }
//   h+= "</table>";
//   $(this.element).html(h);
// }
