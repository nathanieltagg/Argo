#ifndef TREEELEMENTLOOTER_H
#define TREEELEMENTLOOTER_H

#include <string>
#include <Rtypes.h>
#include <TBranchElement.h>
#include <TVirtualCollectionProxy.h>

// Forward declarations.
class TTree;
class TBranchElement;
class TVirtualCollectionProxy;

class TreeElementLooter {

  // special code to try to get, for example,  vector<float> out of a leaf.
  // Copied liberally from TBranchElement::PrintValue and GetCollectionProxy()->PrintValueSTL

public:
 
  TreeElementLooter(TTree* t, const std::string& branchname);
  ~TreeElementLooter();

  template<typename T> const T* get(UInt_t row);
  

  TTree* fTree;
  std::string fName;
  TBranchElement *fBranch;
  std::string fError;
  TVirtualCollectionProxy*	fProxy;
  Int_t eoffset;
  Int_t offset;
  Bool_t ok;
 
};



template<typename T> 
const T* TreeElementLooter::get(UInt_t row) 
{
    if(!ok) return 0;
    char* pointer = (char*)fProxy->At(row);
    char* ladd = pointer+offset;
    return (T*)(ladd);      // Unchecked cast!
}

#endif /* end of include guard: TREEELEMENTLOOTER_H_WC45LB9D */

