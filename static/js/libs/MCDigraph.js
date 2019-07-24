//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//


$(function(){
  $('div.A-MCDigraph').each(function(){
    var o = new MCDigraph(this);
  });  
});

gMCDigraph = null;
gSelectedTrajectories = [];

function MCDigraph( element )
{
  if(!element) return;
  this.element = element;
  gMCDigraph = this;
   
  // gStateMachine.BindObj("mcChange",this,"Build");
  gStateMachine.Bind("newRecord",this.NewRecord.bind(this));
  $(this.element).resize( this.Rebuild.bind(this) );
  gStateMachine.Bind('hoverChange',this.HoverChanged.bind(this));
  gStateMachine.Bind('selectChange',this.SelectChanged.bind(this));
  gStateMachine.Bind('change-mcparticles',this.Rebuild.bind(this));
  gStateMachine.Bind('change-mctruth',this.Rebuild.bind(this));
  gStateMachine.Bind('change-gtruth',this.Rebuild.bind(this));
}


MCDigraph.prototype.DoClick = function(node,label) 
{
  // Look at the current graph, and see which trajectories are selected.
  // gSelectedTrajectories = [];
 //  $jit.Graph.Util.eachNode(this.st.graph, 
 //    function(node) {
 //      // Run this on every node.
 //      if(node.selected) {
 //        console.log(node.name);
 //        gSelectedTrajectories.push(node.data.ftrackId);
 //      }
 //    }
 //  );
 //  gStateMachine.Trigger("changeSelectedTrajectories");
  ChangeSelection({obj: node.data.particle, type: "mcparticle", collection: gRecord.mcparticles});
};

MCDigraph.prototype.HoverChanged = function() 
{
  // console.warn("MCDigraph::HoverChanged()",gHoverState.type);
  if(!this.st) return;
  $('.mc-jit-node-hover',this.element).removeClass("mc-jit-node-hover"); // clear on any hover change.
  // this.st.clearNodesInPath();
  if(gHoverState.type!="mcparticles") return;
  var id = "particle-track-"+gHoverState.obj.ftrackId;
  // this.st.addNodeInPath(id);
  console.log($('#'+id)[0]);
   $('#'+id).addClass("mc-jit-node-hover");
//   
};
MCDigraph.prototype.SelectChanged = function() 
{
    if(!this.st) return;
    if(gHoverState.type!="mcparticles") return;
    var id = "particle-track-"+gSelectState.obj.ftrackId;
    this.st.select(id);
}

MCDigraph.prototype.NewRecord = function() 
{
  $(this.element).empty();
  this.st = null;
}

MCDigraph.prototype.Rebuild = function() 
{
  console.log("MCDigraph::Rebuild");
  $(this.element).empty();
  this.st = null;
  var particles = GetSelected("mcparticles");
  
  if(!particles || particles.length === 0) {
    $(this.element).hide();
    return;
  } else {
    $(this.element).show();
  }

  // Prebuild lookup tables
  if(! particles._trkIdToIndex) {
    particles._trkIdToIndex = {};
    for(var i=0;i<particles.length;i++){
      var p = particles[i];
      if(p.ftrackId in particles._trkIdToIndex) console.error("duplicate trkid",p.ftrackId,i,particles._trkIdToIndex[p.ftrackId]);
      particles._trkIdToIndex[p.ftrackId] = i;
    }

    for(var p of particles) {
        p._children_idx = [];
    }
    for(var i=0;i<particles.length;i++){
      var p = particles[i];
      if(p.fmother!=0) {
        var mother_idx = particles._trkIdToIndex[p.fmother];
        if(mother_idx) {
          particles[mother_idx]._children_idx.push(i);
        }
      }
    }

  }

  // var particle_by_track_id=[];
  // for(var it=0;it<particles.length;it++){
  //   particle_by_track_id[particles[it].ftrackId] = particles[it];
  //   console.log(particles[it].ftrackId,"->",particles[it].fmother);
  // };
  // particle_by_track_id[0] =  gRecord.gtruth[0];
  
  function nodeNameFromMCParticle(p){
    if(!p) return "-error-";
    var nname = "";
    if(p.fpdgCode) {
      var particle_name = GetParticle(p.fpdgCode);
      nname += "<span style='float:left;'>" + particle_name + "</span>";
    }
    if(p && p.trajectory && p.trajectory[0]) {
      var start =  p.trajectory[0];
      var E = start.E;
      var px = start.px;
      var py = start.py;
      var pz = start.pz;
      var p2 = px*px + py*py + pz*pz;
      var ke = E - p.fmass;
      var eround = Math.round(ke*1000);
      var etext = eround + " MeV";
      if(eround < 1 ) {
        etext = Math.round(ke*1e6) + " keV";
      } 
      nname += "<span style='float:right;'>"+etext+"</span>";
    }
    if(p.process) nname += " " + p.process;
    return nname;
  }
  
  function buildNestedObject(p,list) 
  {
    var trkid = p.ftrackId;
    // console.log("Building node",trkid);
    // var p = particle_by_track_id[trkid];
    var node = { id: "particle-track-"+trkid,
                 name: "unknown",
                 data: {},
                 children: []
               };
    node.name = nodeNameFromMCParticle(p);
    node.data = { particle: p };
  
    // This is WAAAAY too slow. 
    // for(var i=0;i<list.length; i++) {
    //   if(particles[list[i]].fmother === trkid) { 
    //     node.children.push(buildNestedObject(particles[list[i]],list));
    //   }
    // }

    for(var idx of p._children_idx) {
      // if(list.includes(idx))
        node.children.push(buildNestedObject(particles[idx],list));      
    }

    return node;
  }
  
  // build root node.
  var root = { id: 0, data: null, children:[] };
   // Modify the root object to be the interaction.

  root.name = "MC Truth";
  
  // Add MCTruth nodes to the root node.
  // for(var truthtype in gRecord.mctruth) {
  var truthtype = GetSelectedName("mctruth");
  if(truthtype){
    var tname = truthtype.split('_')[1]; // Get generator name
    // create a node for each generator class
    var typenode = { id: tname, data: gRecord.mctruth[truthtype], children:[], name: tname };

    for(var imctruth = 0; imctruth<gRecord.mctruth[truthtype].length; imctruth++) {
      var mctruth = gRecord.mctruth[truthtype][imctruth];
      // create a node for each generator
      var mctruthnode = { id: tname+imctruth, data: mctruth, name: tname+" "+imctruth, children:[]};
      
      if(mctruth.neutrino.nu && mctruth.neutrino.nu.fpdgCode) {
        mctruthnode.name = nodeNameFromMCParticle(mctruth.neutrino.nu);
        mctruthnode.name += "<br/>" + mctruth.neutrino.CCNC + " " + mctruth.neutrino.interactiontype;
      } else {
        mctruthnode.name = tname+imctruth + "<br/>" + mctruth.particles.length + " particles";
      }
      
      // association list from truthtype/name to mcparticles index i
      var list = (((gRecord.associations||{})[truthtype]||{})[GetSelectedName("mcparticles")] ||[])[imctruth]||[];

      // If associations bad in some way, just use all particle list
      if(list.length==0) list = Array(particles.length).fill().map((_, idx) => idx);
      for(var i=0;i<list.length; i++) {
        if(particles[list[i]].fmother==0) {
          mctruthnode.children.push(buildNestedObject(particles[list[i]],list));          
        }
      }

      // Now see if there is a generator node linked.
      var glist = (((gRecord.associations||{})[truthtype]||{})[GetSelectedName("gtruth")] ||[])[imctruth]||[];
      console.log(truthtype,imctruth,glist);
      if(glist.length>0){
        var gtruth = GetSelected("gtruth")[glist[0]];
        if(gtruth) {
          console.log("GOT ASSOCITED GTRUTH");
          var gnode = { id: 'gtruth'+glist[0], data: gtruth, children:[mctruthnode]};
          gnode.name= GetParticle(gtruth.fProbePDG)+"&rarr;"+GetParticle(gtruth.ftgtPDG);
          for(attr in gtruth) {
            if(attr.startsWith("f"))gnode.name+="<br/>"+attr+ '&nbsp;'+JSON.stringify(gtruth[attr]);
          }
          mctruthnode = gnode; // Insert it into the chain before the mctruthnode
        }
      }
      if(glist.length>1) console.error("I dont know why, but this mctruth list is associated with more than one gtruth record.")
      
      
      typenode.children.push(mctruthnode);
      
    }
    
    root.children.push(typenode);
  }
  console.log("Tree constructed:",root);
  
  // var inters = gRecord.gtruth[gMCTruthListName];
  // if(inters && inters[0]) {
  //   var inter = inters[0];
  //   var incE = inter.fProbeP4_fE || inter.fProbeP4.E; // Newer and older versions
  //   root.name = incE.toFixed(3)  + " GeV"  +
  //              " " + GetParticle(inter.fProbePDG) +
  //              " " + InteractionCode[inter.fGint] +
  //              " " + ScatterCode[inter.fGscatter];
  // }
  // for(var i=0;i<particles.length; i++) {
  //   if(particles[i].fmother === 0){
  //     // console.log("adding to root:",particles[i],particles[i].ftrackId);
  //     // Find which thing they're associated with.
  //     root.children.push(buildNestedObject(particles[i]));
  //   }
  // }
  
  // var root = buildNestedObject(0);
    
  // console.warn(root);
  
  // EXTREME COOLNESS: http://philogb.github.com/jit/
  
  var self = this;
  this.st = new $jit.ST({
    //id of viz container element
    injectInto: this.element.id,
    //set duration for the animation
    duration: 300,
    //set animation transition type
    transition: $jit.Trans.Quart.easeInOut,
    //set distance between node and its children
    levelDistance: 50,
    // How deep to go by default
    levelsToShow: 4, 
    //enable panning
    Navigation: {
      enable:true,
      panning:true
    },
    //set node and edge styles
    //set overridable=true for styling individual
    //nodes or edges
    Node: {
        height: 20,
        width: 80,
        type: 'rectangle',
        color: '#aaa',
        overridable: true
    },
        
    Edge: {
        type: 'bezier',
        overridable: true
    },
        
    onBeforeCompute: function(node){
        console.log("loading " + node.name);
    },
        
    onAfterCompute: function(){
        console.log("done");
    },
        
    //This method is called on DOM label creation.
    //Use this method to add event handlers and styles to
    //your node.
    onCreateLabel: function(label, node){
        label.id = node.id;            
        label.innerHTML = node.name;
        //set label styles
        label.onclick = function(){
            self.st.onClick(node.id);
            self.DoClick(node,label);
            return false;
        };
        var style = label.style;
        style.width = 70 + 'px';
        style.height = 17 + 'px';            
        style.cursor = 'pointer';
        style.color = '#333';
        style.fontSize = '0.8em';
        style.textAlign= 'left';
        style.paddingTop = '3px';
    },
        
    //This method is called right before plotting
    //a node. It's useful for changing an individual node
    //style properties before plotting it.
    //The data properties prefixed with a dollar
    //sign will override the global node style properties.
    onBeforePlotNode: function(node){
        //add some color to the nodes in the path between the
        //root node and the selected node.
        if (node.selected) {
            node.data.$color = "#ff7";
        }
        else {
            delete node.data.$color;
            //if the node belongs to the last plotted level
            if(!node.anySubnode("exist")) {
                //count children number
                // var count = 0;
                //                 node.eachSubnode(function(n) { count++; });
                //                 //assign a node color based on
                //                 //how many children it has
                //                 node.data.$color = ['#aaa', '#baa', '#caa', '#daa', '#eaa', '#faa'][count];                    
            }
        }
    },
        
    //This method is called right before plotting
    //an edge. It's useful for changing an individual edge
    //style properties before plotting it.
    //Edge data proprties prefixed with a dollar sign will
    //override the Edge global style properties.
    onBeforePlotLine: function(adj){
        if (adj.nodeFrom.selected && adj.nodeTo.selected) {
            adj.data.$color = "#eed";
            adj.data.$lineWidth = 3;
        }
        else {
            delete adj.data.$color;
            delete adj.data.$lineWidth;
        }
    },
    Events:{
      enable: true,
      onMouseEnter: function(node,eventInfo, e) {
        $('.mc-jit-node-hover').removeClass("mc-jit-node-hover");
        $('#'+node.id).addClass("mc-jit-node-hover");
        console.log("HOVER:",node,eventInfo, e);
        ChangeHover({obj: node.data.particle, type: "mcparticle", collection: gRecord.mcparticles});
      },
      onMouseLeave: function(node,eventInfo, e) {
        $('#'+node.id).removeClass("mc-jit-node-hover");        
        if(gHoverState.obj == node.data.particle) ClearHover();
      },
      // onClick:function(node){
      //     self.st.onClick(node.id);
      //     self.DoClick(node);
      // }
      
    }
    
  });
  
  this.st.loadJSON(root);
  this.st.compute();
  this.st.geom.translate(new $jit.Complex(-200, 0), "current");
  
  this.st.onClick(this.st.root);
  
};


