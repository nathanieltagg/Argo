#ifndef PLEXUS_H
#define PLEXUS_H

#include <string>
#include <map>
#include <memory>

//
// A class to interface to the what-connects-to-what database.
//

namespace gov
{
namespace fnal
{
namespace uboone
{
namespace online
{

class Plexus
{
public:
  class Plek {
  public:
    Plek();
    virtual ~Plek() {};
    int crate()   const {return _crate;};
    int card()    const {return _card;};
    int channel() const {return _channel;};
    int asic_id() const {return _asic_id;}
    int servicecard_id() const {return _servicecard_id;}
    
    bool isPmt() const { return (_pmt>=0 && _type =='P'); }
    bool isWire() const { return (_wirenum>=0); }

    char view()     const { return _view; }; // U,V,Y
    int  plane()    const { return _plane; };  // 0-2 plane id
    int  planewire()const { return _planewire; }; // number 0-4000ish of wire in the plane
    int  wirenum()  const { return _wirenum; }; // number to 8155 of the wire in the detector

    int   pmt()      const { return _pmt;  };
    char  pmtType()  const { return _type; };
    char  gain()     const { return _gain; }; // kLow='L', kHigh='H' other for special or unmapped.
    std::string stream() const { return _stream; }
    std::string special() const { if(_type=='P') return ""; else return std::string() + (isprint(_type)?_type:'?') + std::to_string(_pmt); }; // name of special channel, "" for unmapped
    enum pmt_gain_t { kLow = 'L', kHigh = 'H' };
    
    std::string to_string() const;
    std::string to_json() const;

    // ALL must have this:
    int  _crate;   // crate number
    int  _card;    // slot of readout card
    int  _channel; // 0-63 in motherboard  

    // TPC-related values.
    char _view; // U,V,Y
    int  _plane;  // 0-2 plane id
    int  _planewire; // number 0-4000ish of wire in the plane
    int  _wirenum; // number to 8155 of the wire in the detector
    int  _asic_id;
    int  _servicecard_id;

    // PMT-related values.
    char _type;
    int  _pmt;
    char  _gain; // 'L' = low, 'H' = high, other for special or unmapped.
    
    std::string _stream; // which stream is this PMT going to?
      
    std::map<std::string,std::string> _info; // Other connection info.
  };
  
  Plexus();          
  ~Plexus();
  
  // Configuration. Source is something like "sqlite blah.db"
  // or "postgres host=blah.fnal.gov user=soandso"
  void assignSources(
    const std::string& tpc_source,  
    const std::string& pmt_source,  
    const std::string& tpc_source_fallback="",    
    const std::string& pmt_source_fallback=""); 

  bool rebuild(double event_time, double query_time=0);

  bool is_ok() const { return m_ok; }; 
  const Plek& get(int crate, int card, int channel);
  const Plek& get_wirenum(int wirenum); // larsoft "raw" channel id


protected:
  bool buildTpc(double event_time, double query_time, const std::string& source);
  bool buildTpcPostgres (double event_time, double query_time,const std::string& source);
  bool buildTpcSqlite   (double event_time, double query_time,const std::string& source);
  bool buildTpcHardcoded(double event_time);

  bool buildPmt(double event_time, double query_time, const std::string& source);
  bool buildPmtPostgres (double event_time, double query_time, const std::string& source);
  bool buildPmtSqlite   (double event_time, double query_time, const std::string& source);
  bool buildPmtHardcoded(double event_time);
  
  void fixPlek(Plek& plek);
  void insert(Plek& plek);
  void addPlek(Plek& p) { m_ccc_to_plek[ccc(p._crate,p._card,p._channel)] = p;}
  
  int ccc(int crate,int card, int channel);

  typedef std::map<int,Plek> MapType_t;
  MapType_t   m_ccc_to_plek;
  MapType_t   m_wirenum_to_plek;

  bool        m_ok = false;

  double  m_validity_start;
  double  m_validity_end;
  
  std::string m_tpc_source;
  std::string m_pmt_source;
  std::string m_tpc_source_fallback;
  std::string m_pmt_source_fallback;

  std::string m_tpc_source_used;
  std::string m_pmt_source_used;

  Plek m_nullplek;  
};
        
}}}} // namespace

#endif /* end of include guard: PLEXUS_H */
