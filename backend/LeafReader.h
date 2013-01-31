// 
// 
// 
// // basic interface:
// T getValue<>T(const char* 'leafname',index, index2)
// 
// 
// TString getXml(const char* tagname, const char* 'leafname',int index=0,int second_index=-1);
// 
// returns <tagname>value</tagname> if it exists
// returns "" if it doesnt or if value out of range.
// marks leafname as used if it is
// 
// use leaf->GetLenStatic() to find the secondary array size (num columns)
// use leaf->GetLen() to find total number of values. (Divide by num columns to get num rows)
// String can be formatted by checking
//         leaf->GetTypeName()
//         and checking to see if its a double or a float,
//         and simply cut out decimals.
// 
// member values;
// ttree (to get leaves)
// array of flags to see if leaves have been accessed.

#ifndef LEAFREADER_H
#define LEAFREADER_H

class TTree;
class TLeaf;
#include <TObject.h>
#include <string>
#include <map>
#include <vector>
#include <XmlElement.h>

class LeafReader
{
public:
  LeafReader(TTree* tree);
  ~LeafReader();
  
  Double_t    getVal(TLeaf* leaf, int index = 0, int second_index = -1);
  Double_t    getVal(const std::string& leafname, int index = 0, int second_index = -1);
  Int_t       getInt(const std::string& leafname, int index = 0, int second_index = -1)
              {  return (Int_t)getVal(leafname,index,second_index); }  // FIXME - casting here converts, might have roundoff error.
  Int_t       getInt(TLeaf* leaf, int index = 0, int second_index = -1)
              {  return (Int_t)getVal(leaf,index,second_index); }  // FIXME ditto

  std::string getStr(TLeaf* leaf, int index = 0, int second_index = -1);
  XmlElement  getXml(const std::string& tagname, const std::string& leafname, int index = 0, int second_index = -1);
  XmlElement  getXml(const std::string& tagname, TLeaf* leaf, int index = 0, int second_index = -1);

  XmlElement  getXmlArray(const std::string& tagname, const std::string& leafname);
  XmlElement  getXmlArray(const std::string& tagname, const std::string& leafname, int index); // loop over second index.
  
  std::vector<std::string> getUnusedLeaves();
  
  void MarkLeafUsed(TLeaf*);
  
  TTree* fTree;
  std::map<TLeaf*, int> fUsedLeaves;
  
};



#endif /* LEAFREADER_H */


