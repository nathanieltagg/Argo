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
  gStateMachine.BindObj("recordChange",this,"NewRecord");
  var self = this;
  $(this.element).resize( function(ev){ self.NewRecord(); });                                               
  gStateMachine.BindObj('hoverChange',this,"HoverChanged");
  
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
  ChangeSelection({obj: node.data.particle, type: "mcparticle", collection: gRecord.mc.particles});
};

MCDigraph.prototype.HoverChanged = function() 
{
  // console.warn("MCDigraph::HoverChanged()",gHoverState.type);
  if(!this.st) return;
  $('.mc-jit-node-hover').removeClass("mc-jit-node-hover"); // clear on any hover change.
  // this.st.clearNodesInPath();
  if(gHoverState.type!="mcparticle") return;
  var id = "particle-track-"+gHoverState.obj.ftrackId;
  // this.st.addNodeInPath(id);
   $('#'+id).addClass("mc-jit-node-hover");
//   
};

MCDigraph.prototype.NewRecord = function() 
{
  $(this.element).empty();
  this.st = null;
  if(!gRecord) return;
  if(!gRecord.mc) return;
  var particles = gRecord.mc.particles[gMCParticlesListName];
  
  if(!particles || particles.length === 0) {
    $(this.element).hide();
    return;
  } else {
    $(this.element).show();
  }

  // var particle_by_track_id=[];
  // for(var it=0;it<particles.length;it++){
  //   particle_by_track_id[particles[it].ftrackId] = particles[it];
  //   console.log(particles[it].ftrackId,"->",particles[it].fmother);
  // };
  // particle_by_track_id[0] =  gRecord.mc.gtruth[0];
  
  function buildNestedObject(p) 
  {
    var trkid = p.ftrackId;
    // console.log("Building node",trkid);
    // var p = particle_by_track_id[trkid];
    var node = { id: "particle-track-"+trkid,
                 name: "unknown",
                 data: {},
                 children: []
               };
    if(p && p.trajectory && p.trajectory[0]) {
      var particle_name = GetParticle(p.fpdgCode);
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
      node.name = "<span style='float:left;'>" + particle_name + "</span><span style='float:right;'>"+etext+"</span>";
      node.data = { particle: p };
    }
    
    for(var i=0;i<particles.length; i++) {
      if(particles[i].fmother === trkid) { 
        node.children.push(buildNestedObject(particles[i]));
      }
    }
    return node;
  }
  
  // build root node.
  var root = { id: 0, data: gRecord.mc.gtruth[0], children:[] };
   // Modify the root object to be the interaction.
  
  var inters = gRecord.mc.gtruth[gMCTruthListName];
  if(inters && inters[0]) {
    var inter = inters[0];
    var incE = inter.fProbeP4_fE;
    root.name = incE.toFixed(3)  + " GeV"  +
               " " + GetParticle(inter.fProbePDG) +
               " " + InteractionCode[inter.fGint] +
               " " + ScatterCode[inter.fGscatter];  
  }
  for(var i=0;i<particles.length; i++) {
    if(particles[i].fmother === 0){
      // console.log("adding to root:",particles[i],particles[i].ftrackId);
      root.children.push(buildNestedObject(particles[i]));
    }
  }
  
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
        ChangeHover({obj: node.data.particle, type: "mcparticle", collection: gRecord.mc.particles});
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


