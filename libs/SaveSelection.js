
// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...

$(function(){
  $('div.A-saveselection').each(function(){
    gSaveSelection = new SaveSelection(this);
  });  
});


// Subclass of Pad.
SaveSelection.prototype = new ABoundObject;           

function SaveSelection( element )
{
  if(element === undefined) return; // null function call.
  
  var settings = {
  };
  ABoundObject.call(this, element, settings); // Give settings to Pad contructor.

  this.data = [];
  this.event_id = {};
  this.hits = [];
  this.text_element = $(this.element).children(".saveselection-text");
  
  var self = this;

  $(this.element).children(".saveselection-go-button").click( this.Do.bind(this) );
 
  gStateMachine.Bind('recordChange',  this.NewRecord.bind(this));
}


SaveSelection.prototype.NewRecord = function()
{
  if(this.hits) {
    this.data.push({header:this.event_id,hits:this.hits});
  }
  // reset.
  this.event_id = $.extend({},gRecord.header);  
  this.hits = [];
  $(this.text_element).html("hits: " + this.hits.length);
  
}

SaveSelection.prototype.AddHit = function(hit)
{
  hit.saveselection=1;
  removeA(this.hits,hit);
  this.hits.push(hit);
  $(this.text_element).html("hits: " + this.hits.length);
}

SaveSelection.prototype.RemoveHit = function(hit)
{
  delete hit.saveselection;
  removeA(this.hits,hit);
  $(this.text_element).html("hits: " + this.hits.length);
}


SaveSelection.prototype.Do = function()
{
  if(this.hits) {
    this.data.push({header:this.event_id,hits:this.hits});
  }
  var file = window.prompt("Filename to save in /uboone/data/users/tagg/argofeedback","blah.json");
  $.post("server/saveFile.cgi",{file:file,data:JSON.stringify(this.data)});
}

function removeA(arr) {
    var what, a = arguments, L = a.length, ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax= arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}

