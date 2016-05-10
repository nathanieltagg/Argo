
#include "DeadChannelMap.h"
#include <iostream>
#include <fstream>

DeadChannelMap* gDeadChannelMap = new DeadChannelMap();

DeadChannelMap::DeadChannelMap(const std::string& filename) 
  : _ok(false)
{
  Rebuild(filename);
}


void DeadChannelMap::Rebuild(const std::string& filename) 
{
  _ok = false;
  _map.clear();
  std::ifstream in(filename.c_str());
  if(!in.good()) {
    std::cout << "Could not open " << filename << " for reading" <<std::endl;
  }
  // First four lines are header: validity, validity, names, types.
  char dummy[256];
  in.getline(dummy,256);
  in.getline(dummy,256);
  in.getline(dummy,256);
  in.getline(dummy,256);
  while(!in.eof()) {
    int chan, status;
    char dum;
    in >> chan >> dum >> status;
    _map[chan] = status;
  }
  _ok = true;
  std::cout << "Dead channel map loaded from " << filename << " with " << _map.size() << " channels" << std::endl;
}
