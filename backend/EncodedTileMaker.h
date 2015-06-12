#ifndef ENCODEDTILEMAKER_H_FE65EB56
#define ENCODEDTILEMAKER_H_FE65EB56

#include "MakePng.h"
#include "JsonElement.h"
#include "RootToJson.h"
#include <string>
#include <map>
#include <memory>

typedef std::vector<int16_t> waveform_t;
typedef std::shared_ptr<waveform_t> waveform_ptr_t;
typedef std::map<int, waveform_ptr_t > wiremap_t;

void        wireOfChannel(int channel, int& plane, int& wire);


class EncodedTileMaker
{
public:
  EncodedTileMaker( std::shared_ptr<wiremap_t> wireMap, int wireStart, int wireEnd, size_t tdcStart, size_t tdcEnd,
    const std::string& outDir,
    const std::string& outUrl )
    : m_wireMap(wireMap)
    , m_wireStart(wireStart)
    , m_wireEnd(wireEnd)
    , m_tdcStart(tdcStart)
    , m_tdcEnd(tdcEnd)
    , m_outDir(outDir)
    , m_outUrl(outUrl)
  {}
  
  void process() // Nice and wrapped up, ready to be called in a thread.
  {
    int ntdc = (m_tdcEnd-m_tdcStart);
    MakePng m_png(ntdc,(m_wireEnd-m_wireStart),MakePng::rgb);
    std::vector<unsigned char> encodeddata(ntdc*3);    // Three bytes per entry.

    for(int wire=m_wireStart;wire<m_wireEnd;wire++) 
    {
      // waveform_t& waveform = blank;
      wiremap_t::iterator it = m_wireMap->find(wire);
      if(it != m_wireMap->end()) {
        // We have a good wire recorded.0
        waveform_t& waveform = *(it->second.get());
        
        for(int k=0;k<ntdc;k++) {
          int iadc = waveform[k+m_tdcStart] + 0x8000;
          // iadc = (k+m_tdcStart - 4800)/2 + 0x8000; // Testing only :generates a linear slope map
          encodeddata[k*3]   = 0xFF&(iadc>>8);
          encodeddata[k*3+1] = iadc&0xFF;
          encodeddata[k*3+2] = 0;
        }
        m_png.AddRow(encodeddata);
      } else {
        // Do not have wire info.
        for(int k=0;k<ntdc;k++) {
          // Save bitpacked data as image map.
          encodeddata[k*3]   = 0;
          encodeddata[k*3+1] = 0;
          encodeddata[k*3+2] = 0;
        }
        m_png.AddRow(encodeddata);
      }
    }
    m_png.Finish();
    m_filename = m_png.writeToUniqueFile(m_outDir);
    std::cout << "Tile written to " << m_filename << std::endl;
    // Done!
  }
  
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
  
};

void MakeEncodedTileset(JsonObject& output,
                        std::shared_ptr<wiremap_t> wireMap, 
                        size_t nwires,
                        size_t ntdc,
                        const std::string& path,
                        const std::string& url);


#endif /* end of include guard: ENCODEDTILEMAKER_H_FE65EB56 */

