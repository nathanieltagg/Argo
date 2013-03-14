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


function MCDigraph( element )
{
  this.fElement = element;
    
  // gStateMachine.BindObj("mcChange",this,"Build");
  gStateMachine.BindObj("recordChange",this,"NewRecord");
  var self = this;
  $(this.fElement).resize( function(ev){ self.NewRecord(); });                                               
  
}


MCDigraph.prototype.DoClick = function(node,label) 
{
  // Look at the current graph, and see which trajectories are selected.
  gSelectedTrajectories = [];
  $jit.Graph.Util.eachNode(this.st.graph, 
    function(node) {
      // Run this on every node.
      if(node.selected) {
        console.log(node.name);
        gSelectedTrajectories.push(node.data.trajectory);
      }
    }
  );
  gStateMachine.Trigger("changeSelectedTrajectories");
}

MCDigraph.prototype.NewRecord = function() 
{
  $(this.fElement).empty();
  this.st = null;
  if(!gRecord) return;
  if(!gRecord.mc) return;
  var particles = []; //gRecord.mc.particles;
  
  if(particles.length == 0) {
    $(this.fElement).hide();
    return;
  } else {
    $(this.fElement).show();
  }

  var trajs =[];
  var trajectories={};
  for(var it=0;it<trajs.length;it++){
    var traj = trajs[it];
    var trkid = traj.trkid;
    trajectories[trkid] = {
      traj:   traj,
      trkid:  trkid,
      parent: traj.parentid
    };
  };
  trajectories[0] = { interaction: gRecord.mc.interactions[0], trkid: 0 };
  
  function buildNestedObject(trkid) 
  {
    // console.log("Building node",trkid);
    var traj = trajectories[trkid];
    var node = { id: trkid,
                 name: "unknown",
                 data: {},
                 children: []
               };
    if(traj && traj.traj) {
      var particle = GetParticle(traj.traj.pdg);
      var start =  traj.traj.trajpoint[0];
      var E = start.E;
      var px = start.px;
      var py = start.py;
      var pz = start.pz;
      var p2 = px*px + py*py + pz*pz;
      var m2 = E*E - p2;
      var ke = E
      if(m2>0)  ke = E-Math.sqrt(m2);
      var eround = Math.round(ke);
      var etext = eround + " MeV";
      if(eround == 0 ) {
        etext = Math.round(ke*1000) + " keV";
      } 
      node.name = "<span style='float:left;'>" + particle + "</span><span style='float:right;'>"+etext+"</span>";
      node.data = {trajectory: traj.traj};
    }
    

    for(var i in trajectories) {
      if(trajectories[i].parent == trkid) { 
        node.children.push(buildNestedObject(i));
      };
    }
    return node;
  }
  
  var root = buildNestedObject(0);
  // Modify the root object to be the interaction.
  var inter = gRecord.mc.interactions[0];
  var incE = inter.incomingE/1000;
  var channel = inter.channel;
  var current = inter.current;
  root.name = incE.toFixed(3)  + " GeV" 
            + " " + GetParticle(inter.incomingPDG)
            + " " + CurrentCode[current]
            + " " + ChannelCode[channel];  
    
    
  console.warn(root);
  
  // EXTREME COOLNESS: http://philogb.github.com/jit/
  
  var self = this;
  this.st = new $jit.ST({
    //id of viz container element
    injectInto: 'mc-digraph',
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
        label.onclick = function(){
            self.st.onClick(node.id);
            self.DoClick(node,label);
        };
        //set label styles
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
    }
    
  });
  
  this.st.loadJSON(root);
  this.st.compute();
  this.st.geom.translate(new $jit.Complex(-200, 0), "current");
  
  this.st.onClick(this.st.root);
  
}
