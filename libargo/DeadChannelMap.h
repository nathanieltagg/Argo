#ifndef DEADCHANNELMAP_H_BD462AED
#define DEADCHANNELMAP_H_BD462AED

#include <string>
#include <map>
#include <istream>

class DeadChannelMap {
public:
  DeadChannelMap();
  bool Rebuild(const std::string& filename = "../db/dead_channels.txt");
  bool RebuildFromTimestamp(double ts);

  // 0: Disconnected
  // 1: Dead
  // 2: Low Noise (effectively dead)
  // 3: Noisy
  // 4: Good

  enum { 
    kUnknown = -1,
    kDisconnected = 0,
    kDead = 1,
    kLowNoise = 2,
    kNoisy = 3,
    kGood = 4
  } ChannelStatus_t;
  
  int status(int larsoft_channel) const { 
    dcmap_t::const_iterator it = _map.find(larsoft_channel);
    if(it==_map.end()) return -1;
    return it->second;
  }
  bool ok() const { return _ok; }

  private:
  bool Read(std::istream& in);
  
  typedef std::map<int,int> dcmap_t;
  dcmap_t _map;
  bool _ok;


};

extern DeadChannelMap* gDeadChannelMap;

#endif /* end of include guard: DEADCHANNELMAP_H_BD462AED */
