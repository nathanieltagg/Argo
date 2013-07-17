#ifndef PLEXUS_H
#define PLEXUS_H

#include <string>
#include <map>
#include <memory>

//
// A class to interface to the what-connects-to-what database.
//

class sqlite3;

class Plexus
{
public:
  class Plek {
    public:
      Plek();
    // A single connection.
    int  crate;   // crate number
    int  card;    // slot of readout card
    int  channel; // 0-63 in motherboard
    char view; // U,V,Y
    int  plane;  // 0-2 plane id
    int  planewire; // number 0-4000ish of wire in the plane
    int  wirenum; // number to 8155 of the wire in the detector
  };
  typedef std::shared_ptr<Plek> PlekPtr_t;


  Plexus( const std::string& interface="postgresql", 
          const std::string& connection="host=localhost port=5432" );          
  ~Plexus();
  bool is_ok();
 
  PlekPtr_t get(int crate, int card, int channel);
protected:
  int ccc(int crate,int card, int channel);
  typedef std::map<int,PlekPtr_t> MapType_t;
  MapType_t m_ccc_to_plek;
  bool m_ok;
  
};
        


#endif /* end of include guard: PLEXUS_H */
