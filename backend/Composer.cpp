#include "Composer.h"
#include "json.hpp"

#include <TFile.h>
#include <TTree.h>
#include <TTreeFormula.h>


void Composer::satisfy_request(const Request_t request, Result_t output)
{
  // Check to see if our current event matches the request.
  // Get the event specified in the request.
  // Build the _consituent map, including mutexes.
  // Start a thread pool
  // For each order in request/pointers:
  //   new thread (get_or_compose(pointer))
  // Wait for all threads to end.
  // Copy data from _consituents to the result.
  // output[pointer] = get_or_compose(pointer);
  // The get_or_compose
 

}


Json_t Composer::get_or_compose(std::string jsonPointer)
{
  return nullptr;
}
// May block.  May be put into a thread
// Put a read lock on the data pointed to by the jsonPointer, wait until released,
// See if there is data there. If not, upgrade to a write lock. Call compose() on that data.
// Return when data available.

void Composer::compose(std::string jsonPointer, Result_t& result)
{

}
// Compose. should ONLY be called from get_or_compose. 
// No mutex locking required at this stage: compose the result json object (or array or whatever)

  
int64_t Composer::find_entry_in_tree(TTree* inTree, std::string& inSelection, int64_t inStart, int64_t inEnd, std::string& error)
{ 
  // Utility function for finding events in a TTree.
  // Returns an entry number, with event loaded.
  // inStart is the first event we should consider to match. Used when doing next_event
  // If we are doing a backwards search, we set inStart to be negative.
  // inEnd is the last event we should consider. Used when doing prev_event
  // inSelection is a selection that we should apply to the tree.
 
  // OK, find the entry in question.
  if(!inTree) { error = "No tree found."; return -1; }
  
  int64_t nentries = inTree->GetEntriesFast();
  if(nentries<1){
    return -2;
    error = std::string("No entries in tree") + inTree->GetName(); 
    return -1;
  }

  // Scan through entries, looking for specified selection.
  TTreeFormula* select = new TTreeFormula("Selection",inSelection.c_str(),inTree);
  if (!select) {
      error = "Could not create TTreeFormula.";
      return -1;
  }
  if (!select->GetNdim()) {
    delete select;
    error = "Problem with your selection function..";
    return -1;
  }

  int64_t jentry;
  bool match = false;
  if( inStart >=0 ) {
    // Forward search, situation normal
    int64_t stop = nentries;
    if(inEnd>0 && inEnd<stop) stop = inEnd;
    for (jentry=inStart; jentry<stop; jentry++) {
      // cerr << "GetEntry(" << jentry << ")" << endl;
      //tree->GetEntry(jentry);
      inTree->LoadTree(jentry);
      // Does the selection match any part of the tree?
      int nsel = select->GetNdata();
      for(int i=0;i<nsel;i++) {
        if(select->EvalInstance(i) != 0){
          match = true; break;
        }
      }
      if(match) break;
    }
  } else {
    // inStart<0 : backward search
    int64_t start = nentries+inStart;
    if(start>=nentries) start = nentries-1;
    if(start<0) start = 0;
    int64_t stop = 0;
    if(inEnd>0 && inEnd<=start) stop = inEnd;
    for (jentry=start; jentry>=stop; jentry--) {
      // cerr << "GetEntry(" << jentry << ")" << endl;
      //tree->GetEntry(jentry);
      inTree->LoadTree(jentry);
      // Does the selection match any part of the tree?
      int nsel = select->GetNdata();
      for(int i=0;i<nsel;i++) {
        if(select->EvalInstance(i) != 0){
          match = true; break;
        }
      }
      if(match) break;
    }
  }
  delete select;
  if(!match) {
    error = "No events matched selection.";
    return -1;
  }
  return jentry; // The matched event.
}  
