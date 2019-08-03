
#include "DeadChannelMap.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <boost/thread/mutex.hpp>
#include <curl/curl.h>

static boost::mutex gDeadChannelMutex;
DeadChannelMap* gDeadChannelMap = new DeadChannelMap();


DeadChannelMap::DeadChannelMap() 
  : _ok(false)
{
  boost::mutex::scoped_lock b(gDeadChannelMutex);
  curl_global_init(CURL_GLOBAL_DEFAULT);
}

static std::stringstream curlbuffer;
static size_t CurlWriteCallback(void *contents, size_t size, size_t nmemb, void *userp)
{ 
    size_t realsize = size * nmemb;
    curlbuffer.write((const char*)contents, realsize);
    return realsize;
}

bool DeadChannelMap::RebuildFromTimestamp(double ts)
{
  _ok = false;
  boost::mutex::scoped_lock b(gDeadChannelMutex);

  CURL *curl = curl_easy_init();
  if(!curl) return(false);
  std::string url = "http://dbdata0vm.fnal.gov:8186/uboonecon_prod/app/data?f=channelstatus_data&t=" + std::to_string(ts);
  std::cout << "Trying to get dead channel map: " << url << std::endl;
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_TIMEOUT, 2L);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, CurlWriteCallback);
  CURLcode res = curl_easy_perform(curl);
  curl_easy_cleanup(curl);
  if(res!=0) {
    std::cout << "Problem opening url " << url << " for dead channel map" << std::endl;
    return _ok;
  }
  Read(curlbuffer);
  if(_ok) std::cout << "Dead channel map loaded from " << url << " with " << _map.size() << " channels" << std::endl;
  return _ok;
} 

bool DeadChannelMap::Rebuild(const std::string& filename) 
{
  _ok = false;
  _map.clear();
  std::ifstream in(filename.c_str());
  if(!in.good()) {
    std::cout << "Could not open " << filename << " for reading" <<std::endl;
    return _ok;
  }

  Read(in);
  if(_ok) std::cout << "Dead channel map loaded from " << filename << " with " << _map.size() << " channels" << std::endl;
  return _ok;
}

bool DeadChannelMap::Read(std::istream& in) 
{
  _ok = false;
  int nchan = 0;
  int nbad = 0;
  _map.clear();
  try {
    if(!in.good()) {
      std::cout << "Problem opening istream for reading" <<std::endl;
      return _ok;
    }
    // First four lines are header: validity, validity, names, types.
    char dummy[256];
    in.getline(dummy,256); std::cout << "DEADCHANNEL MAP HEADER " << dummy << std::endl;
    in.getline(dummy,256); std::cout << "DEADCHANNEL MAP HEADER " << dummy << std::endl;
    in.getline(dummy,256); std::cout << "DEADCHANNEL MAP HEADER " << dummy << std::endl;
    in.getline(dummy,256); std::cout << "DEADCHANNEL MAP HEADER " << dummy << std::endl;
    while(!in.eof()) {
      int chan, status;
      char dum;
      in >> chan >> dum >> status;
      _map[chan] = status;
      nchan++;
      if(status<4) nbad++;
    }
    _ok = true;
    std::cout << "Loaded bad channel map with " << nchan << " channels, of which " << nbad << " are bad" << std::endl;
    return _ok;      
  } catch(...) {};
  return _ok;
}
