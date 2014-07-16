
// parse filesizes by human-readable size format.
// $.tablesorter.addParser({ 
//         // set a unique id 
//         id: 'hrsize', 
//         is: function(s) { 
//             // return false so this parser is not auto detected 
//             return false; 
//         }, 
//         format: function(s) { 
//             // format your data for normalization 
//             var x =  parseFloat(s);
//             var kb = /kB/;
//             var mb = /MB/;
//             var gb = /GB/;
//             var tb = /TB/;
//             if (kb.test(s)) x*=1024;
//             else if (mb.test(s)) x*=1024*1024;
//             else if (gb.test(s)) x*=1024*1024*1024;
//             else if (tb.test(s)) x*=1024*1024*1024*1024;
//             return x;
//         }, 
//         // set type, either numeric or text 
//         type: 'numeric' 
// }); 
         

$(function(){
  // $('table.filetable tr:even').addClass('highlight');
  // $("table.filetable").addClass("testing").tablesorter({ headers: { 2: { sorter: 'hrsize' }}}); 
  $("table.filetable").addClass("sortable");
});
