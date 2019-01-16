#ifndef ENCODEDTILEMAKER_H_FE65EB56
#define ENCODEDTILEMAKER_H_FE65EB56

#include "MakePng.h"
#include "json.hpp"
#include "RootToJson.h"
#include <string>
#include <map>
#include <memory>

// typedef std::vector<int16_t> waveform_t;
struct waveform_t : public std::vector<int16_t>
{
  waveform_t(size_t n=0, int16_t def=0) : std::vector<int16_t>(n,def)  {_pedwidth=0; _servicecard=0; _status=4;}
  waveform_t(const waveform_t& other) : std::vector<int16_t>(other)  {_pedwidth=other._pedwidth; _servicecard = other._servicecard;  _status = other._status;}
  waveform_t(const std::vector<int16_t>& other) : std::vector<int16_t>(other)  {_pedwidth=0; _servicecard=0; _status=4;}
  int8_t  _pedwidth;
  uint8_t  _servicecard;
  int8_t  _status;
};

typedef std::shared_ptr<waveform_t> waveform_ptr_t;
typedef std::vector<waveform_ptr_t > wiremap_t;

void        wireOfChannel(int channel, int& plane, int& wire);


class EncodedTileMaker
{
public:
  EncodedTileMaker( std::shared_ptr<wiremap_t> wireMap, std::shared_ptr<wiremap_t> noiseWireMap, int wireStart, int wireEnd, size_t tdcStart, size_t tdcEnd,
    const std::string& outDir,
    const std::string& outUrl,
    bool fill_empty_space )
    : m_wireMap(wireMap) 
    , m_noiseWireMap(noiseWireMap)
    , m_wireStart(wireStart)
    , m_wireEnd(wireEnd)
    , m_tdcStart(tdcStart)
    , m_tdcEnd(tdcEnd)
    , m_outDir(outDir)
    , m_outUrl(outUrl)
    , m_fill_empty_space(fill_empty_space)
    
  {}
  
  void process();
  
  nlohmann::json json() {
    nlohmann::json j;
    j["url"]=m_outUrl + m_filename;
    j["x"]=m_tdcStart;
    j["y"]=m_wireStart;
    j["width"]=(m_tdcEnd-m_tdcStart);
    j["height"]=(m_wireEnd-m_wireStart);
    return j;
  }

  std::shared_ptr<wiremap_t> m_wireMap;
  std::shared_ptr<wiremap_t> m_noiseWireMap;
  int m_wireStart;
  int m_wireEnd;
  int m_tdcStart;
  int m_tdcEnd;
  std::string m_outDir;
  std::string m_outUrl;
  std::string m_filename;
  bool m_fill_empty_space;
  static int s_compression;
  
};

void MakeEncodedTileset(nlohmann::json& output,
                        std::shared_ptr<wiremap_t> wireMap, 
                        std::shared_ptr<wiremap_t> noiseWireMap,                         
                        size_t nwires,
                        size_t ntdc,
                        const std::string& path,
                        const std::string& url,
                        int  tilesize,
                        bool fill_empty_space=false);

void MakeLowres(nlohmann::json& r,
            std::shared_ptr<wiremap_t> wireMap, 
            std::shared_ptr<wiremap_t> noiseWireMap,                                     
            size_t nwire,
            size_t nsamp,
            const std::string& path,
            const std::string& url,
            int  tilesize,
            bool fill_emty_space);
                        

#endif /* end of include guard: ENCODEDTILEMAKER_H_FE65EB56 */

