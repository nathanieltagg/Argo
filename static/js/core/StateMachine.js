//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

///
/// Code to handle generic 'events', but without reference to DOM
///

// possible events I use:
// gateChange
// sliceChange
// timeCutChange
// phCutChange
// phColorChange

function StateMachine()
{
  this.state = 'initializing';
  this.triggers = {};  
  this.eventQueue = [];
  this.eventExecuting = false;
  
  this.stats = {};
  var self = this;
  $(document).on("statemachine:trigger", this.DoTrigger.bind(this) );
}


//
// ChangeState() : Use this to change the machine's state.
//

StateMachine.prototype.ChangeState = function( newstate )
{  
  this.state = newstate;
  this.Trigger('statechange');
};

//
// AddCallback() : Add a new callback.
//


StateMachine.prototype.Bind = function( trigType, callback )
{
  
  if(!(trigType in this.triggers)) this.triggers[trigType] = [];
  this.triggers[trigType].push(callback);
};


//
// AddObjCallback() : Add a new callback, using a provided object (typically 'this')
//


StateMachine.prototype.BindObj = function( trigType, obj, callback )
{
  
  if(!(trigType in this.triggers)) this.triggers[trigType] = [];
  this.triggers[trigType].push(function(){return obj[callback]();});
};

//
//  Trigger() : call all registered callbacks.
//

StateMachine.prototype.SimplifyQueue = function( callstack )
{
  // Remove redundant entries from an event queue.
  var newlist=[];
  var n = this.eventQueue.length;
  for(var i=0;i<n;i++) {
    var m = newlist.length;
    var add = 1;
    for(var j=0;j<m;j++) {
      if(this.eventQueue[i].trigType===newlist[j].trigType) add = 0;
    }
    newlist.push(this.eventQueue[i]);
    if(add>0) {}
    else console.warn("Redundant event in statemachine queue:",this.eventQueue[i]);
  }
  this.eventQueue = newlist;
};

StateMachine.prototype.Trigger = function( trigType, data )
{
  // console.warn('StateMachine::Trigger',trigType);
  // Queue a callback.
  $( document ).trigger( "statemachine:trigger", [ trigType, data, Error().stack ] );

  
}

StateMachine.prototype.DoTrigger = function( rawEvent, trigType, data, callstack )
{
  // New logic:
  // We don't want trigger cascades:
  // Rebuild
  //   object 1 -> trigger recolor
  //   ReColor
  //   object 2 -> trigger recolor
  //   ReColor
  // (finish rebuild)
  // because this causes needless recolor events.
  //
  // Instead, let's create a queue of events we want to have happen.
  //
  console.log('StateMachine::DoTrigger',trigType);
  this.eventQueue.push({trigType:trigType, data:data, trigger_callstack:callstack});

  if(this.eventExecuting) {
    // console.log("Pushing " + trigType + " into event queue for delayed execution.");
    // We're already in the midst of doing things. Queue this trigger to fire when we're done.
    // console.log('StateMachine::Trigger -> '+trigType+' QUEUED FOR LATER EXECUTION');
    return;
  }
  this.eventExecuting = true;
  
  while(this.eventQueue.length>0) {
    // remove redudant entries in the eventQueue.
    this.SimplifyQueue();

    var ev =  this.eventQueue.shift();
    var t = ev.trigType;
    
    //console.debug("StateMachine::Trigger -> ",trigType);

    if(!(t in this.triggers)) {
      console.warn("StateMachine::Trigger called with trigger type ",t," which has no registrants. Maybe a typo? Triggered at ",callstack);
      continue; // skip to next event.
    }
    //console.trace();
    //console.profile();  // Useful for optimizing.

    // console.log("StateMachine::Trigger -> "+t);
    // console.time("StateMachine::Trigger -> "+t);
    var startTime = $.now();
    for(var i=0;i<this.triggers[t].length;i++) {
      // console.time("Trigger"+i);
      // console.log("Running trigger ",this.triggers[t][i]);
      var cb = this.triggers[t][i];
      cb(ev.data);
      // console.timeEnd("Trigger"+i);
    }
    var endTime = $.now();
    if(!this.stats[t]) this.stats[t] = [];
    this.stats[t].push(endTime-startTime);
    // console.timeEnd("StateMachine::Trigger -> "+t);

    //sconsole.profileEnd();
  }

  var h = "";
  for(var i in this.stats) {
    var tot = 0;
    var n = this.stats[i].length;
    for(var k=0;k<n;k++) {tot += this.stats[i][k];}
    h += "<span class='stateMachineStat'>" + i + ": " + tot/n + " ms (" + n + " calls)</span>";
  }
  $('#stateMachineStats').html(h)
  
  this.eventExecuting = false;
  
  return 0;
};

gStateMachine = new StateMachine();
