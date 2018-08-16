
#include "KvpSet.h"
#include <list>
#include <algorithm>
#include <iostream>



namespace gov
{
namespace fnal
{
namespace uboone
{
namespace dispatcher
{


using namespace gov::fnal::uboone;


KvpSet::KvpSet(const std::string& str)
{
  parse(str);
}

KvpSet::KvpSet(const std::string& str, const std::string& defaults)
{
  parse(defaults);
  parse(str);
}
void  KvpSet::clear() 
{ 
  //erase everything
  mData.erase(mData.begin(),mData.end());
}

void  KvpSet::clear(const std::string& key) 
{ 
  // erase one key.
  kvpMap_t::iterator it = mData.find(key);
  if(it!=mData.end()) mData.erase(it); 
}  

void  KvpSet::parse(std::string str)
{
  // Strip whitespace.
  // str.erase(remove_if(str.begin(), str.end(), isspace), str.end());
  
  if(str.length()==0) return;
  // split the string
  std::list<std::string> entries;
  std::string delimiters = ";,";

  std::string::size_type pos, lastPos = 0;
  while(true){
    pos = str.find_first_of(delimiters, lastPos);  // Find next ;
    if(pos == std::string::npos) {
      if(str.length() != lastPos)                 // Skip if empty entry at end, e.g. "a=3;"
        entries.push_back(str.substr(lastPos));   // Can't find one. build last entry and quit.
      break;
    }
    if(pos-lastPos >0 ) { // if the string is non-zero
      entries.push_back(str.substr(lastPos, (pos-lastPos)) ); // Add an entry
    }
    lastPos = pos+1; // Skip over the semicolon
  }
  
  for( std::list<std::string>::iterator it = entries.begin(); it != entries.end(); it++) {
    // Look for equal sign
    std::string::size_type pos = it->find_first_of("=");
    std::string keystr = it->substr(0,pos);
    // Strip whitespace.
    keystr.erase(remove_if(keystr.begin(), keystr.end(), isspace), keystr.end());
    std::string valstr("");

    if(pos != std::string::npos) valstr = it->substr(pos+1);
    if(keystr.length()>0 && keystr[0]!=0 ){
      mData[keystr] = valstr;
    }
  }
  
}

void KvpSet::merge(const KvpSet& other) 
{
  kvpMap_t::const_iterator it;
  for(it = other.mData.begin(); it != other.mData.end(); it++) {
    mData[it->first] = it->second;
  }
}


std::string KvpSet::str() const
{
  std::string s;
  kvpMap_t::const_iterator it;
  for(it=mData.begin(); it!= mData.end(); it++)  {
    s += it->first + "=" + it->second + ";";
  }
  return s;
}


std::string KvpSet::pretty_print() const
{
  std::string s;
  kvpMap_t::const_iterator it;
  for(it=mData.begin(); it!= mData.end(); it++)  {
    s += "  \"" + it->first + "\"  -> " + it->second + "\n";
  }
  return s;
}


int    KvpSet::parseInt(const std::string& value, int default_val) const
{
  int v;
  if(value.substr(0,2) == "0x" ||value.substr(0,2) == "0X" ) {
    int got = sscanf(value.substr(2).c_str(),"%x",(unsigned int*)&v);
    if(got<1) return default_val;
    return v;
  }
  int got = sscanf(value.c_str(),"%d",&v);
  if(got<1) return default_val;
  return v;  
}

double KvpSet::parseDouble(const std::string& value, double default_val) const
{
  double v;
  int got = sscanf(value.c_str(),"%lf",&v);
  if(got<1) return default_val;
  return v;  
  
}

}}}} // namespace
