//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//


$(function(){
  $('div.A-PFDigraph').each(function(){
    var o = new PFDigraph(this);
  });  
});

gPFDigraph = null;
gSelectedPFParticle = [];

function PFDigraph( element )
{
  if(!element) return;
  this.element = element;
  gPFDigraph = this;
   
  // gStateMachine.BindObj("mcChange",this,"Build");
  gStateMachine.Bind("change-pfparticles",this.NewRecord.bind(this) );
  $(this.element).resize(                 this.NewRecord.bind(this) );                                               
  gStateMachine.Bind('hoverChange',       this.HoverChanged.bind(this));
 
  $('#ctl-switch-to-pandora').click(function(){
    console.log("switch to pandora products");
    var others = gRecord.associations[GetSelectedName("pfparticles")];
    for(o in others){
      ChangeSelected("",o);
    }
  });
}


PFDigraph.prototype.DoClick = function(node,label) 
{
  // Look at the current graph, and see which trajectories are selected.
  ChangeSelection({obj: node.data.particle, type: "pfparticle", collection: gRecord.pfparticles});
};

PFDigraph.prototype.HoverChanged = function() 
{
  // console.warn("PFDigraph::HoverChanged()",gHoverState.type);
  if(!this.st) return;
  $('.pf-jit-node-hover').removeClass("pf-jit-node-hover"); // clear on any hover change.
  // this.st.clearNodesInPath();
  if(gHoverState.type!="pfparticles") return;
  var id = "particle-track-"+gHoverState.obj.ftrackId;
  // this.st.addNodeInPath(id);
   $('#'+id).addClass("pf-jit-node-hover");
//   
};

PFDigraph.prototype.NewRecord = function() 
{
  
  $(this.element).empty();
  this.st = null;
  var pfparticles = GetSelected("pfparticles");
  
  if(!pfparticles || pfparticles.length === 0) {
    $(this.element).hide();
    return;
  } else {
    $(this.element).show();
  }
  
  function buildPfNode(p) 
  {
    if(!p) return null;
    if(!p.pdg) return null;
    var particle_name = GetParticle(p.pdg);
    var node = {id: p.self, data: p, name: particle_name, children:[]};
    for(var j=0;j<p.daughters.length;j++) {
      // Trap strange error where a particle is it's own daughter.
      if(p.daughters[j]== p._idx) {console.error("PFParticle is it's own daughter!"); continue;}
      // console.log("daughter",p.daughters[j]);
      // console.log("daughter",pfparticles[p.daughters[j]]);
      
      node.children.push(buildPfNode(pfparticles[p.daughters[j]]));
    }
    // console.log(node);
    return node;
  }
  
  var root = { id: 0, data: pfparticles, children:[] };
  root.name = GetSelectedName("pfparticles");
  for(var i=0;i<pfparticles.length;i++) {
    var p = pfparticles[i];
    if(p.parent<0 || p.parent> pfparticles.length) {
      // This is a primary.
      root.children.push(buildPfNode(p));
    }
  }

  // build root node.
    
  // console.warn("PFDigraph",root);
  
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
        width: 40,
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
        $('.pf-jit-node-hover').removeClass("pf-jit-node-hover");
        $('#'+node.id).addClass("pf-jit-node-hover");
        console.log("HOVER:",node,eventInfo, e);
        ChangeHover({obj: node.data, type: "pfparticle", collection: pfparticles});
      },
      onMouseLeave: function(node,eventInfo, e) {
        $('#'+node.id).removeClass("pf-jit-node-hover");        
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


