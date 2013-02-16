#ifndef TREEELEMENTLOOTER_H
#define TREEELEMENTLOOTER_H

#include <string>
#include <RTypes.h>

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
  
  int Setup();
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

#endif /* end of include guard: TREEELEMENTLOOTER_H_WC45LB9D */

