var gHoverState = {
  obj:  null,
  type: "none",
  collection: null
};

function ChangeHover( obj, type, collection )
{
  if(obj!=gHoverState.obj) {
    gHoverState = {
      type: type, obj: obj, collection: collection
    };
    console.log("Hover: ",obj);
    gStateMachine.Trigger("hoverChange_"+type);
  }
}

function ClearHover()
{
  if(gHoverState.obj != null) {
    var type = gHoverState.type;
    gHoverState.obj = null;
    gHoverState.type = "none";
    gHoverState.collection = null;
    gStateMachine.Trigger("hoverChange_"+type);
  }
}