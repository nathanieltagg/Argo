



function do_reco_spacepoints(hits,basis,config)
{
  if(hits.length==0) return;

  var spacepoints = [];
  var idx =0;

  var ymin = config.ymin;
  var ymax = config.ymax;

  var spacepoints = [];

  var hists = [];
  if(config.do_histograms) {
    hists[0] =  new Histogram(500,-50,50);  hists[0].xlabel = "t(plane2) - t(plane0)";
    hists[1] =  new Histogram(500,-50,50);  hists[1].xlabel = "t(plane2) - t(plane1)";
  }
  
  var viewhits = [[],[],[]];
  for(var hit of hits) {
    viewhits[hit._wires[0].view].push(hit);
  }
  console.log("spacepoint reco running with",viewhits[0].length,viewhits[1].length,viewhits[2].length,"hits",this);


  for(var view=1;view<2;view++) {
    var av = basis.along_vectors[view];
    var tv = basis.transverse_vectors[view];
    var toffset = config.toffsets[view];

    for(var hit2 of viewhits[2]) {
      var z = hit2._wires[0].trans;
      var t2 = hit2.t - toffset;
      for(var hit of viewhits[view]) {
        var dt = Math.abs(t2 - hit.t);
        if(dt > config.dt_max)continue;
        var trans = hit._wires[0].trans;
        var y = trans*tv[1]+av[1]/av[2]*(z - trans*tv[2]); // y = t *t_y + a_y/a_z * (z - t* t_z)
        if(y>ymax) continue;
        if(y<ymin) continue;

        if(config.do_histograms) hists[view].Fill(hit2.t-hit.t);
        
        var sp = {
            chisq:0,
            id: idx++,
            t: hit2.t,
            xyz: [ 0, //gGeo3.getXofTDC(0,2,hit2.t - sp_t_off)
                    y, z]
        };
        
        if(idx<config.max_sp)spacepoints.push(sp);
      }
    }
  }

  return {spacepoints: spacepoints,hists: hists};
}


// If this file is loaded by a WebWorker, this is the message handling code.
if('undefined' !== typeof WorkerGlobalScope)  {
  onmessage = function(e) {
    var result = do_reco_spacepoints(...e.data);
    postMessage(result);
  }
}
