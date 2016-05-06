#ifndef ENCODEDTILEMAKER_H_FE65EB56
#define ENCODEDTILEMAKER_H_FE65EB56

#include "MakePng.h"
#include "JsonElement.h"
#include "RootToJson.h"
#include <string>
#include <map>
#include <memory>

// typedef std::vector<int16_t> waveform_t;
struct waveform_t : public std::vector<int16_t>
{
  waveform_t(size_t n=0, int8_t def=0) : std::vector<int16_t>(n,def)  {_pedwidth=0; _servicecard=0;}
  waveform_t(const waveform_t& other) : std::vector<int16_t>(other)  {_pedwidth=other._pedwidth; _servicecard = other._servicecard; }
  waveform_t(const std::vector<int16_t>& other) : std::vector<int16_t>(other)  {_pedwidth=0; _servicecard=0;}
  int8_t  _pedwidth;
  uint8_t  _servicecard;
};

typedef std::shared_ptr<waveform_t> waveform_ptr_t;
typedef std::map<int, waveform_ptr_t > wiremap_t;

void        wireOfChannel(int channel, int& plane, int& wire);


class EncodedTileMaker
{
public:
  EncodedTileMaker( std::shared_ptr<wiremap_t> wireMap, int wireStart, int wireEnd, size_t tdcStart, size_t tdcEnd,
    const std::string& outDir,
    const std::string& outUrl,
    bool fill_empty_space )
    : m_wireMap(wireMap)
    , m_wireStart(wireStart)
    , m_wireEnd(wireEnd)
    , m_tdcStart(tdcStart)
    , m_tdcEnd(tdcEnd)
    , m_outDir(outDir)
    , m_outUrl(outUrl)
    , m_fill_empty_space(fill_empty_space)
  {}
  
  void process();
  
  JsonObject json() {
    JsonObject j;
    j.add("url",m_outUrl + m_filename);
    j.add("x",m_tdcStart);
    j.add("y",m_wireStart);
    j.add("width",(m_tdcEnd-m_tdcStart));
    j.add("height",(m_wireEnd-m_wireStart));
    return j;
  }

  std::shared_ptr<wiremap_t> m_wireMap;
  int m_wireStart;
  int m_wireEnd;
  int m_tdcStart;
  int m_tdcEnd;
  std::string m_outDir;
  std::string m_outUrl;
  std::string m_filename;
  bool m_fill_empty_space;
  
};

void MakeEncodedTileset(JsonObject& output,
                        std::shared_ptr<wiremap_t> wireMap, 
                        size_t nwires,
                        size_t ntdc,
                        const std::string& path,
                        const std::string& url,
                        const std::string& options="",
                        bool fill_empty_space=false);

void MakeLowres(JsonObject& r,
            std::shared_ptr<wiremap_t> wireMap, 
            size_t nwire,
            size_t nsamp,
            const std::string& path,
            const std::string& url,
            const std::string& options,
            bool fill_emty_space);
                        

#endif /* end of include guard: ENCODEDTILEMAKER_H_FE65EB56 */

