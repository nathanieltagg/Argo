#ifndef KvpSet_H_5P0LO2HS
#define KvpSet_H_5P0LO2HS


//
// KvpSet
//
// Key-value-pair parsing.
//

#include <string>
#include <sstream>

#include <map>
#include <vector>

namespace gov
{
namespace fnal
{

namespace uboone{ namespace dispatcher {

class KvpSet
{
public: 
  KvpSet() {};
  KvpSet(const std::string& str);
  KvpSet(const std::string& str, const std::string& defaults);
  void  parse(std::string str);
  void  clear();
  void  clear(const std::string& key);  
  void  merge(const KvpSet& other);

  // Key lookup by string:
  std::string get(const std::string& key, const std::string& default_val="") const;
  bool        has(const std::string& key) const;
  int         getInt(const std::string& key, int default_val=0) const;
  double      getDouble(const std::string& key, double default_val=0) const;
  std::string getString(const std::string& key, std::string default_val="") const { return get(key,default_val); }

  template<typename T>
  void        set(const std::string& key, const T& val);
  
  // For walking through keys 0..n
  int         n() const { return mData.size(); };
  std::string getKey(int i) const;
  std::string getVal(int i) const;
  int         getInt(int i, int default_val=0)       const { return parseInt(getVal(i),default_val); };
  double      getDouble(int i, double default_val=0) const { return parseDouble(getVal(i),default_val); };

  // repack for transmission
  std::string str() const;

  // For display
  std::string pretty_print() const;

protected:
  typedef std::map<std::string, std::string> kvpMap_t;
  kvpMap_t mData;

  // utility
  int    parseInt(const std::string& value, int default_val=0) const;
  double parseDouble(const std::string& value, double default_val=0) const;
};


///
/// Template and inline functions
///



template<typename T>
inline void  KvpSet::set(const std::string& key, const T& val) 
{
  std::ostringstream tmp; 
  tmp << val;
  mData[key] = tmp.str();
}

// lookup accessors;
inline std::string KvpSet::get(const std::string& key, const std::string& default_val) const
{
  kvpMap_t::const_iterator it = mData.find(key);
  if(it != mData.end()) return it->second;
  return default_val;
} 

inline bool KvpSet::has(const std::string& key) const
{
   return (mData.count(key) != 0); 
}

inline int KvpSet::getInt(const std::string& key, int default_val) const
{
  kvpMap_t::const_iterator it = mData.find(key);
  if(it != mData.end()) return parseInt(it->second,default_val);
  return default_val;
}
 
inline double KvpSet::getDouble(const std::string& key, double default_val) const
{
  kvpMap_t::const_iterator it = mData.find(key);
  if(it != mData.end()) return parseDouble(it->second,default_val);
  return default_val;
}


// integer accessors
inline std::string KvpSet::getKey(int i) const
{
  kvpMap_t::const_iterator it = mData.begin();
  for(int ii=0;ii<i; ii++) {it++;}
  return it->first;
}

inline std::string KvpSet::getVal(int i) const
{
  kvpMap_t::const_iterator it;
  it=mData.begin();
  for(int ii=0;ii<i; ii++) {it++;}
  return it->second;
}

  }}}} // end namespace

#endif /* end of include guard: KvpSet_H_5P0LO2HS */
