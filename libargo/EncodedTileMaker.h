#ifndef ENCODEDTILEMAKER_H_FE65EB56
#define ENCODEDTILEMAKER_H_FE65EB56

#include "MakePng.h"
#include "wiremap.h"
#include "json.hpp"
#include "RootToJson.h"
#include <string>
#include <memory>


void        wireOfChannel(int channel, int& plane, int& wire);


class EncodedTileMaker
{
public:
  EncodedTileMaker( std::shared_ptr<wiremap_t> wireMap, 
                    std::shared_ptr<wiremap_t> noiseWireMap, 
                    int wireStart, int wireEnd, size_t tdcStart, size_t tdcEnd,
                    const std::string& outDir,
                    const std::string& outUrl,
                    bool fill_empty_space );

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
  std::string m_temp_pathname;
  std::string m_final_pathname;
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
                        bool fill_empty_space=false,
                        size_t max_threads = 100);

void MakeLowres(nlohmann::json& r,
            std::shared_ptr<wiremap_t> wireMap, 
            std::shared_ptr<wiremap_t> noiseWireMap,
            size_t nwire,
            size_t nsamp,
            const std::string& path,
            const std::string& url,
            int  tilesize,
            bool fill_emty_space,
            size_t max_threads = 10);
                        

#endif /* end of include guard: ENCODEDTILEMAKER_H_FE65EB56 */

