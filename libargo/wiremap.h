#ifndef WIREMAP_H_B58A7339
#define WIREMAP_H_B58A7339

#include <map>
#include <vector>
#include <memory>

struct waveform_t : public std::vector<int16_t>
{
  waveform_t(size_t n=0, int16_t def=0) : std::vector<int16_t>(n,def)  {_pedwidth=0; _servicecard=-1; _status=4;}
  waveform_t(const waveform_t& other) : std::vector<int16_t>(other)  {_pedwidth=other._pedwidth; _servicecard = other._servicecard;  _status = other._status;}
  waveform_t(const std::vector<int16_t>& other) : std::vector<int16_t>(other)  {_pedwidth=0; _servicecard=-1; _status=4;}
  int8_t  _pedwidth;
  int16_t  _servicecard;
  int8_t  _status;
  int8_t  _plane;
  int  _planewire;
};

typedef std::shared_ptr<waveform_t> waveform_ptr_t;
typedef std::vector<waveform_ptr_t > wiremap_t;



#endif /* end of include guard: WIREMAP_H_B58A7339 */
