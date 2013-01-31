//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include <LeafReader.h>
#include <TTree.h>
#include <TLeaf.h>
#include <TError.h>
#include <TClass.h>
#include <sstream>


using std::string;
using std::vector;
using std::map;

LeafReader::LeafReader(TTree* tree)
  : fTree(tree)
{
}

LeafReader::~LeafReader()
{
}

Double_t LeafReader::getVal(TLeaf* leaf, int index, int second_index)
{
  if(!leaf) return -1;
  MarkLeafUsed(leaf);
  
  int i = index;
  if(second_index>=0) {
    // Treat as a 2d array. Should be safe even if it's not.
    Int_t col_size = leaf->GetLenStatic();
    if(second_index >= col_size) { 
      Info("LeafReader::getVal","Requested 2nd dimension element out of bounds. Leafname:%s index:%d index2:%d StaticLen:%d Ndata:%d",leaf->GetName(),index,second_index,leaf->GetLenStatic(),leaf->GetNdata());      
    } else {
      i = second_index + col_size*index;
    }
  }
  if(i >= leaf->GetNdata()) {
    Info("LeafReader::getVal","Requested element out of bounds. Leafname:%s index:%d index2:%d StaticLen:%d Ndata:%d",leaf->GetName(),index,second_index,leaf->GetLenStatic(),leaf->GetNdata());
    return -1;
  }
  return leaf->GetValue(i);
}

Double_t LeafReader::getVal(const string& leafname, int index, int second_index)
{
  TLeaf* leaf = fTree->GetLeaf(leafname.c_str());
  if(!leaf) {
    Info("LeafReader::getVal","tried to get value for nonexistant leaf named %s",leafname.c_str());
    return 0;
  }
  return LeafReader::getVal(leaf,index,second_index);
}


string LeafReader::getStr(TLeaf* leaf, int index, int second_index)
{
  if(!leaf) return "Err";
  std::ostringstream out;
  string type = leaf->IsA()->GetName();
  if((type == string("TLeafD")) || (type == string("TLeafF"))) {
    out << getVal(leaf,index,second_index);
  } else {
    out << getInt(leaf,index,second_index);
  }
  return out.str();
}

XmlElement LeafReader::getXml(const string& tagname, const string& leafname, int index, int second_index)
{
  TLeaf* leaf = fTree->GetLeaf(leafname.c_str());
  return getXml(tagname,leaf,index,second_index);
}

XmlElement LeafReader::getXml(const string& tagname, TLeaf* leaf, int index, int second_index)
{
  if(!leaf) return XmlElement(); // null element.

  string type = leaf->IsA()->GetName();
  if((type == "TLeafD") || (type == "TLeafF")) {
    return XmlElement(tagname,getVal(leaf,index,second_index));
  } 
  
  return XmlElement(tagname,getInt(leaf,index,second_index));
}


XmlElement LeafReader::getXmlArray(const string& tagname, const string& leafname)
{
  TLeaf* leaf = fTree->GetLeaf(leafname.c_str());
  if(!leaf) return XmlElement(); // null element.

  XmlElement e(tagname);
  Int_t n = leaf->GetNdata();
  
  for(int i=0;i<n;++i) {
    e << getStr(leaf,i);
    if(i>0) e<< ",";
  }
  return e;
}


XmlElement LeafReader::getXmlArray(const string& tagname, const string& leafname, Int_t index)
{
  TLeaf* leaf = fTree->GetLeaf(leafname.c_str());
  if(!leaf) return XmlElement(); // null element.

  XmlElement e(tagname);
  Int_t n = leaf->GetLenStatic();
  
  for(int i=0;i<n;++i) {
    if(i>0) e<< ",";
    e << getStr(leaf,index,i);
  }
  return e;
}

void LeafReader::MarkLeafUsed(TLeaf* leaf)
{
  fUsedLeaves[leaf] = 1;
}

std::vector<std::string> LeafReader::getUnusedLeaves()
{
  vector<string> out;
  TObjArray* list = fTree->GetListOfLeaves();
  for(int i=0;i<list->GetEntriesFast();i++) {
    TLeaf* leaf = (TLeaf*)list->At(i);
    map<TLeaf*, int> :: const_iterator it = fUsedLeaves.find(leaf);
    if(it == fUsedLeaves.end()) {
      out.push_back(leaf->GetName());
    }
  }
  return out;
}

